const express = require('express');
const pool = require('../config/db');
const { requireAdminSession } = require('../middleware/auth');
const router = express.Router();

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

// Public: submit admission form
router.post('/admissions', async (req, res) => {
  const studentName      = (req.body.student_name || '').trim();
  const dob              = (req.body.dob || '').trim() || null;
  const gender           = (req.body.gender || '').trim() || null;
  const classApplyingFor = (req.body.class_applying_for || '').trim() || null;
  const programme        = (req.body.programme || '').trim() || null;
  const fatherName       = (req.body.father_name || '').trim() || null;
  const motherName       = (req.body.mother_name || '').trim() || null;
  const parentMobile     = (req.body.parent_mobile || '').trim();
  const email            = (req.body.email || '').trim() || null;
  const address          = (req.body.address || '').trim() || null;

  // Server-side validation
  if (!studentName) {
    req.flash('error', 'Student Name is required. Please fill in the student\'s name.');
    return res.redirect('/#admission');
  }

  if (!gender) {
    req.flash('error', 'Please select a Gender.');
    return res.redirect('/#admission');
  }

  if (!classApplyingFor || !VALID_CLASSES.includes(classApplyingFor)) {
    req.flash('error', 'Please select a valid Class (Nursery to Class VIII).');
    return res.redirect('/#admission');
  }

  if (!programme || !VALID_PROGRAMMES.includes(programme)) {
    req.flash('error', 'Please select a Programme (Art Class, Music Class, or Both).');
    return res.redirect('/#admission');
  }

  if (!parentMobile) {
    req.flash('error', 'Parent Mobile Number is required.');
    return res.redirect('/#admission');
  }

  // Strict mobile number validation
  if (!isValidMobileNumber(parentMobile)) {
    req.flash('error', 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9 (e.g. 9876543210).');
    return res.redirect('/#admission');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    req.flash('error', 'Please enter a valid email address.');
    return res.redirect('/#admission');
  }

  try {
    await pool.query(
      `INSERT INTO admission_applications
       (student_name, dob, gender, class_applying_for, programme, father_name, mother_name, parent_mobile, email, address)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [studentName, dob, gender, classApplyingFor, programme, fatherName, motherName, parentMobile, email, address]
    );
    req.flash('success', 'Application submitted successfully! Our team will contact you shortly.');
  } catch (err) {
    console.error('[ADMISSIONS POST ERROR]', err);
    req.flash('error', 'Could not submit application. Please check your entries and try again.');
  }
  res.redirect('/#admission');
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