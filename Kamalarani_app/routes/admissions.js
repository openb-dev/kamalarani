const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const pool    = require('../config/db');
const { requireAdminSession } = require('../middleware/auth');
const { processImage }        = require('../utils/imageProcessor');
const router  = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../public/uploads/admissions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const PDF_MAX_BYTES = 5 * 1024 * 1024; // 5 MB hard limit for PDFs (cannot be compressed)
const IMAGE_EXTS    = ['.jpg', '.jpeg', '.png', '.webp'];

// Multer: memory storage so we can compress before writing to disk
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'passport_photo') {
    if (IMAGE_EXTS.includes(ext)) return cb(null, true);
    return cb(new Error('Only JPG, JPEG, PNG, and WEBP images are allowed for passport photo.'));
  }
  if (file.fieldname === 'id_proof') {
    if ([...IMAGE_EXTS, '.pdf'].includes(ext)) return cb(null, true);
    return cb(new Error('Only JPG, JPEG, PNG, WEBP, and PDF files are allowed for identity proof.'));
  }
  cb(new Error('Unexpected file upload.'));
};

// Accept up to 50 MB in memory so we can compress anything down to 5 MB
const uploadDocuments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter
}).fields([
  { name: 'passport_photo', maxCount: 1 },
  { name: 'id_proof',       maxCount: 1 }
]);

/**
 * Save a multer memory-file to disk after processing.
 * Images → resize-first then compress via shared imageProcessor (target: 3 MB).
 * PDFs   → pass-through, reject if > 5 MB.
 * Returns the public URL path string.
 */
async function saveUploadedFile(file) {
  const ext    = path.extname(file.originalname).toLowerCase();
  const prefix = file.fieldname === 'passport_photo' ? 'photo' : 'idproof';
  const uid    = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  if (IMAGE_EXTS.includes(ext)) {
    const processed = await processImage(file.buffer);
    const filename  = `${prefix}-${uid}.jpg`;
    fs.writeFileSync(path.join(uploadDir, filename), processed);
    console.log(
      `[UPLOAD] ${file.fieldname}: ${(file.buffer.length / 1024).toFixed(0)} KB → ` +
      `${(processed.length / 1024).toFixed(0)} KB → ${filename}`
    );
    return '/uploads/admissions/' + filename;
  }

  if (ext === '.pdf') {
    if (file.buffer.length > PDF_MAX_BYTES) {
      throw new Error(
        `PDF file is ${(file.buffer.length / (1024 * 1024)).toFixed(1)} MB. ` +
        'Please upload a PDF smaller than 5 MB, or scan at a lower resolution.'
      );
    }
    const filename = `${prefix}-${uid}.pdf`;
    fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
    return '/uploads/admissions/' + filename;
  }

  throw new Error('Unsupported file type.');
}

// Strict Indian mobile number validator
function isValidMobileNumber(mobileStr) {
  if (!mobileStr) return false;
  let clean = mobileStr.replace(/[\s\-\(\)\+]/g, '');
  if (clean.startsWith('91') && clean.length === 12) {
    clean = clean.slice(2);
  } else if (clean.startsWith('0') && clean.length === 11) {
    clean = clean.slice(1);
  }
  // Must be 10 digits starting with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(clean)) return false;
  // Reject repetitive dummy numbers like 0000000000, 9999999999, 1234567890
  if (/^(\d)\1{9}$/.test(clean)) return false;
  if (clean === '1234567890' || clean === '0123456789') return false;
  return true;
}

function wantsJson(req) {
  return !!(req.xhr ||
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    (req.headers.accept && req.headers.accept.includes('application/json')));
}

// Valid dropdown values
const VALID_CLASSES    = ['Nursery','KG','Class I','Class II','Class III','Class IV','Class V','Class VI','Class VII','Class VIII','Class IX','Class X','Class XI','Class XII','Graduation'];
const VALID_PROGRAMMES = ['Art Class','Music Class','Both','Education Programme','Gita Gyaan','Cultural Programme','Other Programmes'];
const VALID_BRANCHES   = ['Coochbehar','Kolkata'];

const { generateAdmissionPDF } = require('../utils/pdfGenerator');

// Public: submit admission form
router.post('/admissions', (req, res) => {
  uploadDocuments(req, res, async (err) => {
    const isAjax = wantsJson(req);

    const sendError = (msg) => {
      if (res.headersSent) return;
      if (isAjax) {
        return res.status(400).json({ success: false, message: msg });
      }
      req.flash('error', msg);
      return res.redirect('/#admission');
    };

    try {
      if (err) {
        const errorMsg = err instanceof multer.MulterError
          ? 'Upload Error: ' + err.message
          : (err.message || 'File upload failed.');
        return sendError(errorMsg);
      }

      const body = req.body || {};

      const studentName      = String(body.student_name || '').trim();
      const dob              = String(body.dob || '').trim() || null;
      const gender           = String(body.gender || '').trim() || null;
      const schoolName       = String(body.school_name || '').trim() || null;
      const classApplyingFor = String(body.class_applying_for || '').trim() || null;
      const rawProgramme     = String(body.programme || '').trim();
      const programmeDetails = String(body.programme_details || '').trim();
      const branch           = String(body.branch || '').trim() || null;
      const fatherName       = String(body.father_name || '').trim() || null;
      const motherName       = String(body.mother_name || '').trim() || null;
      const occupation       = String(body.occupation || '').trim() || null;
      const parentMobile     = String(body.parent_mobile || '').trim();
      const motherMobile     = String(body.mother_mobile || '').trim() || null;
      const email            = String(body.email || '').trim() || null;
      const aadhaarNo        = String(body.aadhaar_no || '').trim() || null;
      const remarks          = String(body.remarks || '').trim() || null;

      const villageLocality  = String(body.village_locality || '').trim() || null;
      const po               = String(body.po || '').trim() || null;
      const ps               = String(body.ps || '').trim() || null;
      const district         = String(body.district || '').trim() || null;
      const state            = String(body.state || 'West Bengal').trim() || 'West Bengal';
      const pinCode          = String(body.pin_code || '').trim() || null;

      let address = `${villageLocality || ''}, P.O. ${po || ''}, P.S. ${ps || ''}, Dist. ${district || ''}, ${state} - ${pinCode || ''}`
        .replace(/^,\s*/, '')
        .trim();
      if (remarks) {
        address += ` [Remarks: ${remarks}]`;
      }

      const passportFile  = req.files && req.files.passport_photo ? req.files.passport_photo[0] : null;
      const idProofFile   = req.files && req.files.id_proof ? req.files.id_proof[0] : null;

      // Compress and save uploaded files
      let passportPhoto = null;
      let idProof       = null;
      try {
        if (passportFile) passportPhoto = await saveUploadedFile(passportFile);
        if (idProofFile)  idProof       = await saveUploadedFile(idProofFile);
      } catch (fileErr) {
        return sendError(fileErr.message || 'File processing failed.');
      }

      if (!studentName) return sendError('Student Name is required.');
      if (!dob) return sendError('Date of Birth is required.');
      if (!gender) return sendError('Please select a Gender.');
      if (!classApplyingFor || !VALID_CLASSES.includes(classApplyingFor)) {
        return sendError('Please select a valid Class (Nursery to Graduation).');
      }
      if (!rawProgramme || !VALID_PROGRAMMES.includes(rawProgramme)) {
        return sendError('Please select a valid Programme.');
      }

      let programme = rawProgramme;
      if (['Cultural Programme', 'Other Programmes'].includes(rawProgramme)) {
        if (!programmeDetails) {
          return sendError('Please describe the specific programme you wish to enroll in.');
        }
        programme = `${rawProgramme} (${programmeDetails})`;
      }
      if (!branch || !VALID_BRANCHES.includes(branch)) {
        return sendError('Please select a Branch (Coochbehar or Kolkata).');
      }
      if (!fatherName) return sendError('Father\'s Name is required.');
      if (!motherName) return sendError('Mother\'s Name is required.');
      if (!occupation) return sendError('Father\'s / Guardian\'s Occupation is required.');
      if (!parentMobile) return sendError('Parent Mobile Number is required.');
      if (!villageLocality || !po || !ps || !district || !pinCode) {
        return sendError('Complete Residential Address details (Village, P.O., P.S., District, PIN Code) are required.');
      }
      if (!passportPhoto) return sendError('Student\'s Passport-Size Photo is required.');
      if (!idProof) return sendError('Identity Proof (Aadhaar Card / Birth Certificate) is required.');
      if (!isValidMobileNumber(parentMobile)) {
        return sendError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9 (e.g. 9876543210).');
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return sendError('Please enter a valid email address.');
      }

      // Insert first, then set ARN from insertId (avoids COUNT-based unique collisions)
      const [insertResult] = await pool.query(
        `INSERT INTO admission_applications
         (student_name, dob, gender, school_name, class_applying_for, programme, branch, father_name, mother_name, occupation, parent_mobile, mother_mobile, email, aadhaar_no, village_locality, po, ps, district, state, pin_code, address, passport_photo, id_proof)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [studentName, dob, gender, schoolName, classApplyingFor, programme, branch, fatherName, motherName, occupation, parentMobile, motherMobile, email, aadhaarNo, villageLocality, po, ps, district, state, pinCode, address, passportPhoto, idProof]
      );

      const year = new Date().getFullYear();
      const arn = `KFA-${year}-${String(insertResult.insertId).padStart(4, '0')}`;
      await pool.query('UPDATE admission_applications SET arn = ? WHERE id = ?', [arn, insertResult.insertId]);

      const downloadUrl = `/admissions/pdf/${arn}`;

      if (isAjax) {
        return res.json({
          success: true,
          arn,
          student_name: studentName,
          class_applying_for: classApplyingFor,
          programme,
          branch,
          downloadUrl,
          message: 'Application submitted successfully!'
        });
      }

      req.flash('success', `Application submitted successfully! Your Unique Application Ref. No. is <strong>${arn}</strong>. <a href="${downloadUrl}" target="_blank" style="display:inline-block;margin-top:6px;background:var(--vermilion);color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-weight:700;">📄 Click here to Print/Download Admission Form PDF</a>`);
      return res.redirect('/#admission');
    } catch (submitErr) {
      console.error('[ADMISSIONS POST ERROR]', submitErr);
      if (submitErr && submitErr.code === 'ER_BAD_FIELD_ERROR') {
        return sendError('Database is missing required columns. Run: node migrations/apply_admissions_alter.js');
      }
      if (submitErr && submitErr.code === 'ER_DUP_ENTRY') {
        return sendError('An application with this reference already exists. Please try again.');
      }
      return sendError('Could not submit application. Please check your entries and try again.');
    }
  });
});

// Public PDF download route by ARN
router.get('/admissions/pdf/:arn', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM admission_applications WHERE arn = ? OR id = ?', [req.params.arn, req.params.arn]);
    if (!rows.length) {
      req.flash('error', 'Admission application not found.');
      return res.redirect('/#admission');
    }
    generateAdmissionPDF(rows[0], res);
  } catch (err) {
    console.error('[PDF GENERATION ERROR]', err);
    res.status(500).send('Could not generate admission form PDF.');
  }
});

// Admin PDF download route by ID
router.get('/admin/admissions/pdf/:id', requireAdminSession, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM admission_applications WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      req.flash('error', 'Application not found.');
      return res.redirect('/admin/admissions');
    }
    generateAdmissionPDF(rows[0], res);
  } catch (err) {
    console.error('[ADMIN PDF ERROR]', err);
    res.status(500).send('Could not generate admission form PDF.');
  }
});

// Admin: view all applications
router.get('/admin/admissions', requireAdminSession, async (req, res) => {
  try {
    const [apps] = await pool.query('SELECT * FROM admission_applications ORDER BY created_at DESC');
    res.render('admin/admissions', { apps });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load admissions.');
    res.redirect('/admin/dashboard');
  }
});

// Admin: update application status
router.put('/admin/admissions/:id', requireAdminSession, async (req, res) => {
  try {
    await pool.query('UPDATE admission_applications SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    req.flash('success', 'Status updated.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update status.');
  }
  res.redirect('/admin/admissions');
});

// Admin: delete application
router.delete('/admin/admissions/:id', requireAdminSession, async (req, res) => {
  try {
    await pool.query('DELETE FROM admission_applications WHERE id = ?', [req.params.id]);
    req.flash('success', 'Application deleted.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete application.');
  }
  res.redirect('/admin/admissions');
});

module.exports = router;
