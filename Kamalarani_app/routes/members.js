const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { requireAdminSession } = require('../middleware/auth');
const { processImage } = require('../utils/imageProcessor');
const { CREATE_SQL } = require('../migrations/apply_members_table');

const router = express.Router();

const uploadDir = path.join(__dirname, '../public/uploads/members');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (IMAGE_EXTS.includes(ext)) return cb(null, true);
    cb(new Error('Only JPG, JPEG, PNG, and WEBP images are allowed for member photos.'));
  }
}).single('photo');

const VALID_BRANCHES = ['Kolkata', 'Coochbehar'];

let tableReady = false;
async function ensureMembersTable() {
  if (tableReady) return;
  await pool.query(CREATE_SQL);
  const [cols] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'members'
       AND COLUMN_NAME = 'branch'`
  );
  if (!cols[0].cnt) {
    await pool.query("ALTER TABLE members ADD COLUMN branch VARCHAR(50) NULL AFTER phone");
  }
  tableReady = true;
}

function isValidMobileNumber(mobileStr) {
  if (!mobileStr) return false;
  let clean = mobileStr.replace(/[\s\-\(\)\+]/g, '');
  if (clean.startsWith('91') && clean.length === 12) {
    clean = clean.slice(2);
  } else if (clean.startsWith('0') && clean.length === 11) {
    clean = clean.slice(1);
  }
  if (!/^[6-9]\d{9}$/.test(clean)) return false;
  if (/^(\d)\1{9}$/.test(clean)) return false;
  if (clean === '1234567890' || clean === '0123456789') return false;
  return true;
}

function normalisedPhone(mobileStr) {
  let clean = String(mobileStr || '').replace(/[\s\-\(\)\+]/g, '');
  if (clean.startsWith('91') && clean.length === 12) clean = clean.slice(2);
  if (clean.startsWith('0') && clean.length === 11) clean = clean.slice(1);
  return clean;
}

async function saveMemberPhoto(file) {
  const processed = await processImage(file.buffer);
  const filename = `member-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
  fs.writeFileSync(path.join(uploadDir, filename), processed);
  return '/uploads/members/' + filename;
}

function deletePhotoFile(photoUrl) {
  if (!photoUrl || !photoUrl.startsWith('/uploads/members/')) return;
  const filePath = path.join(__dirname, '../public', photoUrl);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) { /* ignore missing files */ }
  }
}

function handleUpload(req, res, next) {
  uploadPhoto(req, res, (err) => {
    if (err) {
      req.flash('error', err.message || 'Photo upload failed.');
      return res.redirect('/admin/members');
    }
    next();
  });
}

router.get('/admin/members', requireAdminSession, async (req, res) => {
  try {
    await ensureMembersTable();
    const [members] = await pool.query(
      `SELECT * FROM members
       ORDER BY FIELD(branch, 'Kolkata', 'Coochbehar') ASC, name ASC`
    );
    res.render('admin/members', { members, editMember: null });
  } catch (err) {
    console.error('[MEMBERS LIST ERROR]', err);
    req.flash('error', 'Failed to load members.');
    res.redirect('/admin/dashboard');
  }
});

router.get('/admin/members/:id/edit', requireAdminSession, async (req, res) => {
  try {
    await ensureMembersTable();
    const [members] = await pool.query(
      `SELECT * FROM members
       ORDER BY FIELD(branch, 'Kolkata', 'Coochbehar') ASC, name ASC`
    );
    const [rows] = await pool.query('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      req.flash('error', 'Member not found.');
      return res.redirect('/admin/members');
    }
    res.render('admin/members', { members, editMember: rows[0] });
  } catch (err) {
    console.error('[MEMBERS EDIT ERROR]', err);
    req.flash('error', 'Member not found.');
    res.redirect('/admin/members');
  }
});

router.post('/admin/members', requireAdminSession, handleUpload, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const fatherName = String(req.body.father_name || '').trim();
  const occupation = String(req.body.occupation || '').trim();
  const branch = String(req.body.branch || '').trim();
  const phone = normalisedPhone(req.body.phone);

  if (!name) {
    req.flash('error', 'Member name is required.');
    return res.redirect('/admin/members');
  }
  if (!fatherName) {
    req.flash('error', "Father's name is required.");
    return res.redirect('/admin/members');
  }
  if (!occupation) {
    req.flash('error', 'Occupation is required.');
    return res.redirect('/admin/members');
  }
  if (!VALID_BRANCHES.includes(branch)) {
    req.flash('error', 'Please select whether the member is from Kolkata or Coochbehar.');
    return res.redirect('/admin/members');
  }
  if (!isValidMobileNumber(phone)) {
    req.flash('error', 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
    return res.redirect('/admin/members');
  }
  if (!req.file) {
    req.flash('error', 'Member photo is required.');
    return res.redirect('/admin/members');
  }

  try {
    await ensureMembersTable();
    const photoUrl = await saveMemberPhoto(req.file);
    await pool.query(
      `INSERT INTO members (name, father_name, occupation, phone, branch, photo_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, fatherName, occupation, phone, branch, photoUrl, req.session.admin.id]
    );
    req.flash('success', 'Member added successfully.');
  } catch (err) {
    console.error('[MEMBER CREATE ERROR]', err);
    req.flash('error', 'Failed to add member: ' + (err.message || ''));
  }
  res.redirect('/admin/members');
});

router.put('/admin/members/:id', requireAdminSession, handleUpload, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const fatherName = String(req.body.father_name || '').trim();
  const occupation = String(req.body.occupation || '').trim();
  const branch = String(req.body.branch || '').trim();
  const phone = normalisedPhone(req.body.phone);
  const redirectTo = `/admin/members/${req.params.id}/edit`;

  if (!name) {
    req.flash('error', 'Member name is required.');
    return res.redirect(redirectTo);
  }
  if (!fatherName) {
    req.flash('error', "Father's name is required.");
    return res.redirect(redirectTo);
  }
  if (!occupation) {
    req.flash('error', 'Occupation is required.');
    return res.redirect(redirectTo);
  }
  if (!VALID_BRANCHES.includes(branch)) {
    req.flash('error', 'Please select whether the member is from Kolkata or Coochbehar.');
    return res.redirect(redirectTo);
  }
  if (!isValidMobileNumber(phone)) {
    req.flash('error', 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
    return res.redirect(redirectTo);
  }

  try {
    await ensureMembersTable();
    const [rows] = await pool.query('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      req.flash('error', 'Member not found.');
      return res.redirect('/admin/members');
    }

    let photoUrl = rows[0].photo_url;
    if (req.file) {
      photoUrl = await saveMemberPhoto(req.file);
      deletePhotoFile(rows[0].photo_url);
    }

    await pool.query(
      `UPDATE members SET name=?, father_name=?, occupation=?, phone=?, branch=?, photo_url=? WHERE id=?`,
      [name, fatherName, occupation, phone, branch, photoUrl, req.params.id]
    );
    req.flash('success', 'Member updated successfully.');
  } catch (err) {
    console.error('[MEMBER UPDATE ERROR]', err);
    req.flash('error', 'Failed to update member: ' + (err.message || ''));
  }
  res.redirect('/admin/members');
});

router.delete('/admin/members/:id', requireAdminSession, async (req, res) => {
  try {
    await ensureMembersTable();
    const [rows] = await pool.query('SELECT photo_url FROM members WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM members WHERE id = ?', [req.params.id]);
    if (rows.length) deletePhotoFile(rows[0].photo_url);
    req.flash('success', 'Member deleted.');
  } catch (err) {
    console.error('[MEMBER DELETE ERROR]', err);
    req.flash('error', 'Failed to delete member.');
  }
  res.redirect('/admin/members');
});

module.exports = router;
