/**
 * Add bilingual columns to events (title_bn, description_bn, location_bn)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../config/db');

const COLUMNS = [
  { name: 'title_bn', sql: 'ADD COLUMN title_bn VARCHAR(255) NULL AFTER title' },
  { name: 'description_bn', sql: 'ADD COLUMN description_bn TEXT NULL AFTER description' },
  { name: 'location_bn', sql: 'ADD COLUMN location_bn VARCHAR(500) NULL AFTER location' }
];

async function run() {
  const conn = await pool.getConnection();
  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events'`
    );
    const existing = new Set(cols.map(c => c.COLUMN_NAME));

    for (const col of COLUMNS) {
      if (existing.has(col.name)) {
        console.log(`✓ ${col.name} already exists`);
        continue;
      }
      await conn.query(`ALTER TABLE events ${col.sql}`);
      console.log(`✓ Added ${col.name}`);
    }
    console.log('Events bilingual migration done.');
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
