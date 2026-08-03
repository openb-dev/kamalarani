const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAdminSession } = require('../middleware/auth');
const router = express.Router();

router.get('/admin/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin/dashboard');
  res.render('admin/login');
});

router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM admins WHERE email = ?', [email]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/admin/login');
    }
    req.session.admin = { id: admin.id, email: admin.email, name: admin.name };
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/admin/login');
  }
});

router.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.get('/admin/dashboard', requireAdminSession, async (req, res) => {
  try {
    const [[{ totalMessages }]] = await pool.query("SELECT COUNT(*) AS totalMessages FROM contact_messages");
    const [[{ newMessages }]]   = await pool.query("SELECT COUNT(*) AS newMessages FROM contact_messages WHERE status = 'new'");
    const [[{ totalApps }]]     = await pool.query("SELECT COUNT(*) AS totalApps FROM admission_applications");
    const [[{ pendingApps }]]   = await pool.query("SELECT COUNT(*) AS pendingApps FROM admission_applications WHERE status = 'pending'");
    const [[{ totalGallery }]]  = await pool.query("SELECT COUNT(*) AS totalGallery FROM gallery_items");
    const [[{ totalEvents }]]   = await pool.query("SELECT COUNT(*) AS totalEvents FROM events");
    const [[{ upcomingEvents }]] = await pool.query("SELECT COUNT(*) AS upcomingEvents FROM events WHERE is_published = TRUE AND event_date >= NOW()");

    // Recent items for quick view
    const [recentMessages]  = await pool.query("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 5");
    const [recentApps]      = await pool.query("SELECT * FROM admission_applications ORDER BY created_at DESC LIMIT 5");

    res.render('admin/dashboard', {
      stats: { totalMessages, newMessages, totalApps, pendingApps, totalGallery, totalEvents, upcomingEvents },
      recentMessages,
      recentApps
    });
  } catch (err) {
    console.error(err);
    res.render('admin/dashboard', {
      stats: { totalMessages: 0, newMessages: 0, totalApps: 0, pendingApps: 0, totalGallery: 0, totalEvents: 0, upcomingEvents: 0 },
      recentMessages: [],
      recentApps: []
    });
  }
});

module.exports = router;