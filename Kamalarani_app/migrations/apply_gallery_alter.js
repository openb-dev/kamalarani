/**
 * Safely add missing gallery_items columns (purpose, event_date, place)
 * and update existing uploaded items with demo July dates and demo locations.
 */
require('dotenv').config();
const pool = require('../config/db');

const COLUMNS = [
  { name: 'purpose',    sql: "ADD COLUMN purpose VARCHAR(255) NULL AFTER caption" },
  { name: 'event_date', sql: "ADD COLUMN event_date DATE NULL AFTER purpose" },
  { name: 'place',      sql: "ADD COLUMN place VARCHAR(255) NULL AFTER event_date" },
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
    console.log('Checking gallery_items schema...');
    for (const col of COLUMNS) {
      if (await columnExists(connection, 'gallery_items', col.name)) {
        console.log(`  skip  ${col.name} (already exists)`);
        continue;
      }
      await connection.query(`ALTER TABLE gallery_items ${col.sql}`);
      console.log(`  added ${col.name}`);
    }

    // Populate demo July dates and places for existing uploaded items
    const [result] = await connection.query(`
      UPDATE gallery_items 
      SET 
        purpose = COALESCE(NULLIF(purpose, ''), NULLIF(caption, ''), 'Free Art Class & Material Distribution'),
        event_date = COALESCE(event_date, '2026-07-15'),
        place = COALESCE(NULLIF(place, ''), CASE WHEN (id % 2) = 0 THEN 'Kolkata' ELSE 'Natabari' END)
      WHERE purpose IS NULL OR purpose = '' OR event_date IS NULL OR place IS NULL OR place = '';
    `);
    console.log(`Updated demo July dates & locations for ${result.affectedRows || 0} existing gallery items.`);

    console.log('✅ Gallery schema and demo data update completed.');
  } catch (err) {
    console.error('Gallery migration error:', err.message);
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  main().then(() => pool.end());
}

module.exports = main;
