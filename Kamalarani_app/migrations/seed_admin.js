require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

(async () => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT IGNORE INTO admins (email, password_hash, name) VALUES (?, ?, ?)',
    [email, hash, 'Foundation Admin']
  );
  console.log('Admin seeded:', email);
  process.exit();
})();