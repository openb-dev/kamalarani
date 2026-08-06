require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 4000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'images', 'logo.png')));

// Body parsing & method override
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Persistent MySQL Session Store
const sessionStore = new MySQLStore({
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, pool);

// Sessions & flash
app.use(session({
  key: 'kamalarani_sid',
  secret: process.env.SESSION_SECRET || 'kamalarani-secret-key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days persistent session
    httpOnly: true
  }
}));
app.use(flash());

// Global locals — safely convert any flash object to string message
app.use((req, res, next) => {
  const rawSuccess = req.flash('success') || [];
  const rawError   = req.flash('error') || [];

  res.locals.success = rawSuccess.map(msg => {
    if (typeof msg === 'string') return msg;
    if (msg && typeof msg === 'object') return msg.message || msg.msg || JSON.stringify(msg);
    return String(msg);
  });

  res.locals.error = rawError.map(msg => {
    if (typeof msg === 'string') return msg;
    if (msg && typeof msg === 'object') return msg.message || msg.msg || JSON.stringify(msg);
    return String(msg);
  });

  res.locals.admin   = req.session.admin || null;
  res.locals.currentPath = req.path;
  next();
});

// Routes
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/contact'));
app.use('/', require('./routes/events'));
app.use('/', require('./routes/gallery'));
app.use('/', require('./routes/admissions'));

// Homepage
app.get('/', async (req, res) => {
  try {
    const [events]  = await pool.query(
      "SELECT * FROM events WHERE is_published = TRUE AND event_date >= NOW() ORDER BY event_date ASC LIMIT 3"
    );
    const [gallery] = await pool.query("SELECT * FROM gallery_items ORDER BY created_at DESC LIMIT 50");
    res.render('index', { events, gallery });
  } catch (err) {
    console.error(err);
    res.render('index', { events: [], gallery: [] });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  const errMsg = err && (err.message || (typeof err === 'string' ? err : 'Internal Server Error'));
  const wantsJson = req.xhr ||
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    (req.headers.accept && req.headers.accept.includes('application/json'));

  if (wantsJson) {
    return res.status(500).json({ success: false, message: errMsg });
  }

  req.flash('error', errMsg);
  res.status(500).redirect(req.header('Referer') || '/');
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));