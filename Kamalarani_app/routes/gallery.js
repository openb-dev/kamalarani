const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { execFile, execFileSync } = require('child_process');
const pool    = require('../config/db');
const { requireAdminSession } = require('../middleware/auth');

const router = express.Router();

// ─── Upload directories ───────────────────────────────────────────────────────
const imageUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'gallery', 'images');
const videoUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'gallery', 'videos');
[imageUploadDir, videoUploadDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ─── Check if ffmpeg is available on the system ───────────────────────────────
let ffmpegAvailable = false;
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  ffmpegAvailable = true;
} catch (_) {
  console.warn('[GALLERY] ffmpeg not found — video compression will be skipped.');
}

// ─── Multer storages ─────────────────────────────────────────────────────────
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imageUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'img-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, videoUploadDir),
  filename: (req, file, cb) => {
    cb(null, 'vid-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + '.mp4');
  }
});

const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png'];
const ALLOWED_VIDEO_EXTS = ['.mp4'];
const VIDEO_COMPRESS_THRESHOLD = 10 * 1024 * 1024; // 10 MB

const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_IMAGE_EXTS.includes(ext)) return cb(null, true);
  cb(new Error('Only JPG, JPEG, and PNG images are allowed.'));
};

const videoFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_VIDEO_EXTS.includes(ext)) return cb(null, true);
  cb(new Error('Only MP4 videos are allowed.'));
};

const uploadImages = multer({ storage: imageStorage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: imageFileFilter });
const uploadVideos = multer({ storage: videoStorage, limits: { fileSize: 500 * 1024 * 1024 }, fileFilter: videoFileFilter });

// ─── Helper: compress a video file using ffmpeg ───────────────────────────────
function compressVideo(inputPath) {
  return new Promise((resolve) => {
    if (!ffmpegAvailable) return resolve(inputPath);

    const ext    = path.extname(inputPath);
    const base   = path.basename(inputPath, ext);
    const dir    = path.dirname(inputPath);
    const outPath = path.join(dir, base + '-compressed' + ext);

    const args = [
      '-i', inputPath,
      '-vcodec', 'libx264',
      '-crf', '28',          // quality (18=best, 51=worst) — 28 is a good balance
      '-preset', 'fast',
      '-acodec', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outPath
    ];

    execFile('ffmpeg', args, (err) => {
      if (err) {
        console.error('[GALLERY COMPRESS] ffmpeg error:', err.message);
        return resolve(inputPath); // fallback to original on error
      }
      // Replace original with compressed
      try {
        fs.unlinkSync(inputPath);
        fs.renameSync(outPath, inputPath);
      } catch (renameErr) {
        console.error('[GALLERY COMPRESS] rename error:', renameErr);
      }
      resolve(inputPath);
    });
  });
}

// ─── PUBLIC: Standalone gallery page ─────────────────────────────────────────
router.get('/gallery', async (req, res) => {
  try {
    const [images] = await pool.query("SELECT * FROM gallery_items WHERE media_type = 'image' ORDER BY created_at DESC");
    const [videos] = await pool.query("SELECT * FROM gallery_items WHERE media_type = 'video' ORDER BY created_at DESC");
    res.render('gallery', { images, videos });
  } catch (err) {
    console.error('[PUBLIC GALLERY]', err);
    res.render('gallery', { images: [], videos: [] });
  }
});

// ─── ADMIN: List gallery items ────────────────────────────────────────────────
router.get('/admin/gallery', requireAdminSession, async (req, res) => {
  try {
    const [images] = await pool.query("SELECT * FROM gallery_items WHERE media_type = 'image' ORDER BY created_at DESC");
    const [videos] = await pool.query("SELECT * FROM gallery_items WHERE media_type = 'video' ORDER BY created_at DESC");
    res.render('admin/gallery', { images, videos, items: [...images, ...videos] });
  } catch (err) {
    console.error('[GALLERY GET] Error:', err);
    req.flash('error', 'Failed to load gallery.');
    res.redirect('/admin/dashboard');
  }
});

// ─── ADMIN: Upload IMAGES ─────────────────────────────────────────────────────
router.post(
  '/admin/gallery/images',
  requireAdminSession,
  (req, res, next) => {
    uploadImages.array('images', 20)(req, res, (err) => {
      if (err) {
        req.flash('error', err instanceof multer.MulterError ? 'Upload Error: ' + err.message : (err.message || 'File upload failed.'));
        return res.redirect('/admin/gallery');
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        req.flash('error', 'No images selected. Please select at least one PNG, JPG, or JPEG image.');
        return res.redirect('/admin/gallery');
      }

      const caption  = (req.body.caption || '').trim() || null;
      const adminId  = req.session.admin ? req.session.admin.id : null;

      for (const file of req.files) {
        const mediaUrl = '/uploads/gallery/images/' + file.filename;
        await pool.query(
          'INSERT INTO gallery_items (media_type, media_url, caption, file_name, uploaded_by) VALUES (?, ?, ?, ?, ?)',
          ['image', mediaUrl, caption, file.filename, adminId]
        );
      }

      req.flash('success', `${req.files.length} image(s) uploaded successfully!`);
      return res.redirect('/admin/gallery');
    } catch (err) {
      console.error('[GALLERY IMAGE UPLOAD DB ERROR]', err);
      if (req.files) req.files.forEach(f => { try { fs.unlinkSync(path.join(imageUploadDir, f.filename)); } catch (_) {} });
      req.flash('error', 'Database error: ' + (err.message || 'Failed to save image.'));
      return res.redirect('/admin/gallery');
    }
  }
);

// ─── ADMIN: Upload VIDEOS ─────────────────────────────────────────────────────
router.post(
  '/admin/gallery/videos',
  requireAdminSession,
  (req, res, next) => {
    uploadVideos.array('videos', 5)(req, res, (err) => {
      if (err) {
        req.flash('error', err instanceof multer.MulterError ? 'Upload Error: ' + err.message : (err.message || 'File upload failed.'));
        return res.redirect('/admin/gallery');
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        req.flash('error', 'No videos selected. Please select at least one MP4 video.');
        return res.redirect('/admin/gallery');
      }

      const caption  = (req.body.caption || '').trim() || null;
      const adminId  = req.session.admin ? req.session.admin.id : null;

      for (const file of req.files) {
        // Auto-compress if over threshold
        if (file.size > VIDEO_COMPRESS_THRESHOLD && ffmpegAvailable) {
          console.log(`[GALLERY] Compressing ${file.filename} (${(file.size / 1024 / 1024).toFixed(1)} MB)…`);
          await compressVideo(path.join(videoUploadDir, file.filename));
          console.log(`[GALLERY] Compression done: ${file.filename}`);
        }

        const mediaUrl = '/uploads/gallery/videos/' + file.filename;
        await pool.query(
          'INSERT INTO gallery_items (media_type, media_url, caption, file_name, uploaded_by) VALUES (?, ?, ?, ?, ?)',
          ['video', mediaUrl, caption, file.filename, adminId]
        );
      }

      req.flash('success', `${req.files.length} video(s) uploaded successfully!${ffmpegAvailable ? ' Large videos were auto-compressed.' : ''}`);
      return res.redirect('/admin/gallery');
    } catch (err) {
      console.error('[GALLERY VIDEO UPLOAD DB ERROR]', err);
      if (req.files) req.files.forEach(f => { try { fs.unlinkSync(path.join(videoUploadDir, f.filename)); } catch (_) {} });
      req.flash('error', 'Database error: ' + (err.message || 'Failed to save video.'));
      return res.redirect('/admin/gallery');
    }
  }
);

// ─── ADMIN: Delete media item ─────────────────────────────────────────────────
router.delete('/admin/gallery/:id', requireAdminSession, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT file_name, media_type FROM gallery_items WHERE id = ?', [req.params.id]);
    if (rows.length && rows[0].file_name) {
      const dir      = rows[0].media_type === 'video' ? videoUploadDir : imageUploadDir;
      const filePath = path.join(dir, rows[0].file_name);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await pool.query('DELETE FROM gallery_items WHERE id = ?', [req.params.id]);
    req.flash('success', 'Item deleted.');
  } catch (err) {
    console.error('[GALLERY DELETE ERROR]', err);
    req.flash('error', 'Failed to delete: ' + (err.message || 'unknown error'));
  }
  res.redirect('/admin/gallery');
});

// ─── ADMIN: Update caption ────────────────────────────────────────────────────
router.put('/admin/gallery/:id', requireAdminSession, async (req, res) => {
  try {
    await pool.query('UPDATE gallery_items SET caption = ? WHERE id = ?', [req.body.caption, req.params.id]);
    req.flash('success', 'Caption updated.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update caption.');
  }
  res.redirect('/admin/gallery');
});

module.exports = router;