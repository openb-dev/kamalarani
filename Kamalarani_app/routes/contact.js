const express = require('express');
const pool = require('../config/db');
const { requireAdminSession } = require('../middleware/auth');
const router = express.Router();

// Public: submit contact form
router.post('/contact', async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim();
  const subject = (req.body.subject || '').trim() || null;
  const message = (req.body.message || '').trim();

  // Server-side validation
  if (!name) {
    req.flash('error', 'Your Name is required.');
    return res.redirect('/#contact');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    req.flash('error', 'Please enter a valid email address.');
    return res.redirect('/#contact');
  }

  if (!message) {
    req.flash('error', 'Please enter a message before submitting.');
    return res.redirect('/#contact');
  }

  try {
    await pool.query(
      'INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name, email, subject, message]
    );
    req.flash('success', 'Message sent! We will get back to you soon.');
  } catch (err) {
    console.error('[CONTACT POST ERROR]', err);
    req.flash('error', 'Could not send message. Please try again.');
  }
  res.redirect('/#contact');
});

// Admin: view all messages
router.get('/admin/messages', requireAdminSession, async (req, res) => {
  try {
    const [messages] = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.render('admin/messages', { messages });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load messages.');
    res.redirect('/admin/dashboard');
  }
});

// Admin: update message status
router.put('/admin/messages/:id', requireAdminSession, async (req, res) => {
  try {
    await pool.query('UPDATE contact_messages SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    req.flash('success', 'Status updated.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update status.');
  }
  res.redirect('/admin/messages');
});

// Admin: delete message
router.delete('/admin/messages/:id', requireAdminSession, async (req, res) => {
  try {
    await pool.query('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
    req.flash('success', 'Message deleted.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete message.');
  }
  res.redirect('/admin/messages');
});

module.exports = router;