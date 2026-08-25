/**
 * Create the members table if it does not already exist.
 * Usage (from Kamalarani_app folder):
 *   node migrations/apply_members_table.js
 */
require('dotenv').config();
const pool = require('../config/db');

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  father_name VARCHAR(255) NULL,
  occupation VARCHAR(255) NULL,
  phone VARCHAR(20) NOT NULL,
  branch VARCHAR(50) NOT NULL,
  photo_url TEXT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
)`;

async function applyMembersTable(connection) {
  await connection.query(CREATE_SQL);
}

async function main() {
  const connection = await pool.getConnection();
  try {
    await applyMembersTable(connection);
    console.log('✅ members table is ready.');
  } catch (err) {
    console.error('Members table migration error:', err.message);
    throw err;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  main().then(() => pool.end()).catch(() => process.exit(1));
}

module.exports = { applyMembersTable, CREATE_SQL };
