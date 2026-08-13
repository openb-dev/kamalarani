const express = require('express');
const pool = require('../config/db');
const { requireAdminSession } = require('../middleware/auth');
const router = express.Router();

// Public calendar — all published events across all time
router.get('/calendar', async (req, res) => {
  try {
    const [events] = await pool.query(
      `SELECT * FROM events WHERE is_published = TRUE ORDER BY event_date ASC`
    );
    res.render('calendar', { events });
  } catch (err) {
    console.error(err);
    res.render('calendar', { events: [] });
  }
});

// API: Get all published events (used by floating calendar widget)
router.get('/api/events', async (req, res) => {
  try {
    const [events] = await pool.query(
      `SELECT * FROM events WHERE is_published = TRUE ORDER BY event_date ASC`
    );
    res.json(events);
  } catch (err) {
    console.error('[API EVENTS ERROR]', err);
    res.status(500).json([]);
  }
});

// View Event History
router.get('/events/:id/history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, a.name AS creator_name 
       FROM events e 
       LEFT JOIN admins a ON e.created_by = a.id 
       WHERE e.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      req.flash('error', 'Event history not found.');
      return res.status(404).render('404');
    }

    res.render('event-history', { event: rows[0] });
  } catch (err) {
    console.error('[EVENT HISTORY ERROR]', err);
    req.flash('error', 'Failed to load event history.');
    res.redirect('/calendar');
  }
});



// Admin: list all events
router.get('/admin/events', requireAdminSession, async (req, res) => {
  try {
    const [events] = await pool.query('SELECT * FROM events ORDER BY event_date DESC');
    res.render('admin/events', { events, editEvent: null });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load events.');
    res.redirect('/admin/dashboard');
  }
});

// Admin: show edit form inline
router.get('/admin/events/:id/edit', requireAdminSession, async (req, res) => {
  try {
    const [events] = await pool.query('SELECT * FROM events ORDER BY event_date DESC');
    const [rows]   = await pool.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    res.render('admin/events', { events, editEvent: rows[0] || null });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Event not found.');
    res.redirect('/admin/events');
  }
});

// Admin: create event
router.post('/admin/events', requireAdminSession, async (req, res) => {
  const title = (req.body.title || '').trim();
  const titleBn = (req.body.title_bn || '').trim() || null;
  const description = (req.body.description || '').trim() || null;
  const descriptionBn = (req.body.description_bn || '').trim() || null;
  const eventDate = (req.body.event_date || '').trim();
  const endDate = (req.body.end_date || '').trim() || null;
  const location = (req.body.location || '').trim();
  const locationBn = (req.body.location_bn || '').trim() || null;
  const isPublished = req.body.is_published === 'on';

  if (!title) {
    req.flash('error', 'Event Title is required.');
    return res.redirect('/admin/events');
  }

  if (!eventDate) {
    req.flash('error', 'Start Date & Time is required.');
    return res.redirect('/admin/events');
  }

  if (!location) {
    req.flash('error', 'Location is required. Please specify where the event will take place.');
    return res.redirect('/admin/events');
  }

  try {
    await pool.query(
      `INSERT INTO events (title, title_bn, description, description_bn, event_date, end_date, location, location_bn, is_published, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, titleBn, description, descriptionBn, eventDate, endDate, location, locationBn, isPublished, req.session.admin.id]
    );
    req.flash('success', 'Event created successfully.');
  } catch (err) {
    console.error('[EVENT CREATE ERROR]', err);
    req.flash('error', 'Failed to create event: ' + (err.message || ''));
  }
  res.redirect('/admin/events');
});

// Admin: update event
router.put('/admin/events/:id', requireAdminSession, async (req, res) => {
  const title = (req.body.title || '').trim();
  const titleBn = (req.body.title_bn || '').trim() || null;
  const description = (req.body.description || '').trim() || null;
  const descriptionBn = (req.body.description_bn || '').trim() || null;
  const eventDate = (req.body.event_date || '').trim();
  const endDate = (req.body.end_date || '').trim() || null;
  const location = (req.body.location || '').trim();
  const locationBn = (req.body.location_bn || '').trim() || null;
  const isPublished = req.body.is_published === 'on';

  if (!title) {
    req.flash('error', 'Event Title is required.');
    return res.redirect(`/admin/events/${req.params.id}/edit`);
  }

  if (!eventDate) {
    req.flash('error', 'Start Date & Time is required.');
    return res.redirect(`/admin/events/${req.params.id}/edit`);
  }

  if (!location) {
    req.flash('error', 'Location is required. Please specify where the event will take place.');
    return res.redirect(`/admin/events/${req.params.id}/edit`);
  }

  try {
    await pool.query(
      `UPDATE events SET title=?, title_bn=?, description=?, description_bn=?, event_date=?, end_date=?, location=?, location_bn=?, is_published=? WHERE id=?`,
      [title, titleBn, description, descriptionBn, eventDate, endDate, location, locationBn, isPublished, req.params.id]
    );
    req.flash('success', 'Event updated successfully.');
  } catch (err) {
    console.error('[EVENT UPDATE ERROR]', err);
    req.flash('error', 'Failed to update event: ' + (err.message || ''));
  }
  res.redirect('/admin/events');
});

// Admin: delete event
router.delete('/admin/events/:id', requireAdminSession, async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    req.flash('success', 'Event deleted.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete event.');
  }
  res.redirect('/admin/events');
});

module.exports = router;