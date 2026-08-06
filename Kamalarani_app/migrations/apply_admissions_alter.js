/**
 * Safely add missing admission_applications columns on an existing DB.
 * Usage (from Kamalarani_app folder):
 *   node migrations/apply_admissions_alter.js
 */
require('dotenv').config();
const pool = require('../config/db');

const COLUMNS = [
  { name: 'arn',              sql: "ADD COLUMN arn VARCHAR(50) UNIQUE AFTER id" },
  { name: 'school_name',      sql: "ADD COLUMN school_name VARCHAR(255) NULL AFTER gender" },
  { name: 'occupation',       sql: "ADD COLUMN occupation VARCHAR(255) NULL AFTER mother_name" },
  { name: 'mother_mobile',    sql: "ADD COLUMN mother_mobile VARCHAR(20) NULL AFTER parent_mobile" },
  { name: 'aadhaar_no',       sql: "ADD COLUMN aadhaar_no VARCHAR(20) NULL AFTER email" },
  { name: 'village_locality', sql: "ADD COLUMN village_locality VARCHAR(255) NULL AFTER aadhaar_no" },
  { name: 'po',               sql: "ADD COLUMN po VARCHAR(255) NULL AFTER village_locality" },
  { name: 'ps',               sql: "ADD COLUMN ps VARCHAR(255) NULL AFTER po" },
  { name: 'district',         sql: "ADD COLUMN district VARCHAR(255) NULL AFTER ps" },
  { name: 'state',            sql: "ADD COLUMN state VARCHAR(100) NULL DEFAULT 'West Bengal' AFTER district" },
  { name: 'pin_code',         sql: "ADD COLUMN pin_code VARCHAR(10) NULL AFTER state" },
];

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].cnt > 0;
}

async function main() {
  const connection = await pool.getConnection();
  try {
    console.log('Connected to DB:', process.env.DB_NAME || '(from pool)');
    for (const col of COLUMNS) {
      if (await columnExists(connection, 'admission_applications', col.name)) {
        console.log(`  skip  ${col.name} (already exists)`);
        continue;
      }
      await connection.query(`ALTER TABLE admission_applications ${col.sql}`);
      console.log(`  added ${col.name}`);
    }
    console.log('Done. Admission form columns are ready.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
