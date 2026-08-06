const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const pool    = require('../config/db');
const { requireAdminSession } = require('../middleware/auth');
const router  = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../public/uploads/admissions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage for admission documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = file.fieldname === 'passport_photo' ? 'photo' : 'idproof';
    cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'passport_photo') {
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return cb(null, true);
    return cb(new Error('Only JPG, JPEG, PNG, and WEBP images are allowed for passport photo.'));
  }
  if (file.fieldname === 'id_proof') {
    if (['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext)) return cb(null, true);
    return cb(new Error('Only JPG, JPEG, PNG, WEBP, and PDF files are allowed for identity proof.'));
  }
  cb(new Error('Unexpected file upload.'));
};

const uploadDocuments = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
}).fields([
  { name: 'passport_photo', maxCount: 1 },
  { name: 'id_proof', maxCount: 1 }
]);

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

// Valid dropdown values
const VALID_CLASSES    = ['Nursery','KG','Class I','Class II','Class III','Class IV','Class V','Class VI','Class VII','Class VIII'];
const VALID_PROGRAMMES = ['Art Class','Music Class','Both'];

const { generateAdmissionPDF } = require('../utils/pdfGenerator');

// Public: submit admission form
router.post('/admissions', (req, res) => {
  uploadDocuments(req, res, async (err) => {
    const isAjax = req.xhr || 
                   req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                   (req.headers.accept && req.headers.accept.includes('application/json'));

    const sendError = (msg) => {
      if (isAjax) {
        return res.status(400).json({ success: false, message: msg });
      }
      req.flash('error', msg);
      return res.redirect('/#admission');
    };

    if (err) {
      const errorMsg = err instanceof multer.MulterError ? 'Upload Error: ' + err.message : (err.message || 'File upload failed.');
      return sendError(errorMsg);
    }

    const body = req.body || {};

    const studentName      = (body.student_name || '').trim();
    const dob              = (body.dob || '').trim() || null;
    const gender           = (body.gender || '').trim() || null;
    const schoolName       = (body.school_name || '').trim() || null;
    const classApplyingFor = (body.class_applying_for || '').trim() || null;
    const programme        = (body.programme || '').trim() || null;
    const fatherName       = (body.father_name || '').trim() || null;
    const motherName       = (body.mother_name || '').trim() || null;
    const occupation       = (body.occupation || '').trim() || null;
    const parentMobile     = (body.parent_mobile || '').trim();
    const motherMobile     = (body.mother_mobile || '').trim() || null;
    const email            = (body.email || '').trim() || null;
    const aadhaarNo        = (body.aadhaar_no || '').trim() || null;

    // Address Breakdown
    const villageLocality  = (body.village_locality || '').trim() || null;
    const po               = (body.po || '').trim() || null;
    const ps               = (body.ps || '').trim() || null;
    const district         = (body.district || '').trim() || null;
    const state            = (body.state || 'West Bengal').trim();
    const pinCode          = (body.pin_code || '').trim() || null;

    // Combined address for compatibility
    const address          = `${villageLocality || ''}, P.O. ${po || ''}, P.S. ${ps || ''}, Dist. ${district || ''}, ${state} - ${pinCode || ''}`.replace(/^, /, '').trim();

    const passportFile     = req.files && req.files['passport_photo'] ? req.files['passport_photo'][0] : null;
    const idProofFile      = req.files && req.files['id_proof'] ? req.files['id_proof'][0] : null;

    const passportPhoto    = passportFile ? '/uploads/admissions/' + passportFile.filename : null;
    const idProof          = idProofFile ? '/uploads/admissions/' + idProofFile.filename : null;

    // Server-side validation
    if (!studentName) return sendError('Student Name is required.');
    if (!dob) return sendError('Date of Birth is required.');
    if (!gender) return sendError('Please select a Gender.');
    if (!classApplyingFor || !VALID_CLASSES.includes(classApplyingFor)) return sendError('Please select a valid Class (Nursery to Class VIII).');
    if (!programme || !VALID_PROGRAMMES.includes(programme)) return sendError('Please select a Programme (Art Class, Music Class, or Both).');
    if (!fatherName) return sendError('Father\'s Name is required.');
    if (!motherName) return sendError('Mother\'s Name is required.');
    if (!occupation) return sendError('Father\'s / Guardian\'s Occupation is required.');
    if (!parentMobile) return sendError('Parent Mobile Number is required.');
    if (!villageLocality || !po || !ps || !district || !pinCode) return sendError('Complete Residential Address details (Village, P.O., P.S., District, PIN Code) are required.');
    if (!passportPhoto) return sendError('Student\'s Passport-Size Photo is required.');
    if (!idProof) return sendError('Identity Proof (Aadhaar Card / Birth Certificate) is required.');

    // Strict mobile number validation
    if (!isValidMobileNumber(parentMobile)) return sendError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9 (e.g. 9876543210).');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError('Please enter a valid email address.');

    try {
      // Generate Unique Application Reference Number (ARN)
      const year = new Date().getFullYear();
      const [countRows] = await pool.query('SELECT COUNT(*) as cnt FROM admission_applications');
      const nextId = (countRows[0].cnt || 0) + 1;
      const arn = `KFA-${year}-${String(nextId).padStart(4, '0')}`;

      await pool.query(
        `INSERT INTO admission_applications
         (arn, student_name, dob, gender, school_name, class_applying_for, programme, father_name, mother_name, occupation, parent_mobile, mother_mobile, email, aadhaar_no, village_locality, po, ps, district, state, pin_code, address, passport_photo, id_proof)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [arn, studentName, dob, gender, schoolName, classApplyingFor, programme, fatherName, motherName, occupation, parentMobile, motherMobile, email, aadhaarNo, villageLocality, po, ps, district, state, pinCode, address, passportPhoto, idProof]
      );

      const downloadUrl = `/admissions/pdf/${arn}`;

      if (isAjax) {
        return res.json({
          success: true,
          arn: arn,
          student_name: studentName,
          class_applying_for: classApplyingFor,
          programme: programme,
          downloadUrl: downloadUrl,
          message: 'Application submitted successfully!'
        });
      }

      req.flash('success', `Application submitted successfully! Your Unique Application Ref. No. is <strong>${arn}</strong>. <a href="${downloadUrl}" target="_blank" style="display:inline-block;margin-top:6px;background:var(--vermilion);color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-weight:700;">📄 Click here to Print/Download Admission Form PDF</a>`);
      return res.redirect('/#admission');
    } catch (dbErr) {
      console.error('[ADMISSIONS POST ERROR]', dbErr);
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