const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Ensure visitor stats table exists
let tableChecked = false;
async function ensureStatsTable() {
  if (tableChecked) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_visitor_stats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        metric_name VARCHAR(50) NOT NULL UNIQUE,
        count_value BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Seed initial baseline count if empty
    await pool.query(`
      INSERT IGNORE INTO site_visitor_stats (metric_name, count_value)
      VALUES ('total_pageviews', 1250)
    `);
    tableChecked = true;
  } catch (err) {
    console.error('[VISITOR STATS DB ERROR]', err.message);
  }
}

/**
 * Fetch total visitor count from Google Analytics Data API if configured,
 * otherwise fallback to MySQL site_visitor_stats.
 */
async function getGAVisitorCount() {
  const propertyId = process.env.GA_PROPERTY_ID;
  const clientEmail = process.env.GA_CLIENT_EMAIL;
  const privateKey = process.env.GA_PRIVATE_KEY;

  if (propertyId && clientEmail && privateKey) {
    try {
      const { BetaAnalyticsDataClient } = require('@google-analytics/data');
      const analyticsDataClient = new BetaAnalyticsDataClient({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
      });

      const [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '2020-01-01', endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }],
      });

      if (response && response.rows && response.rows.length > 0) {
        const gaCount = parseInt(response.rows[0].metricValues[0].value, 10);
        return { count: gaCount, source: 'google_analytics' };
      }
    } catch (err) {
      console.warn('[GA API NOTICE] Could not fetch GA Data API metrics, using local counter fallback:', err.message);
    }
  }

  // Fallback to local DB counter
  await ensureStatsTable();
  try {
    const [rows] = await pool.query(`SELECT count_value FROM site_visitor_stats WHERE metric_name = 'total_pageviews'`);
    const count = rows.length > 0 ? Number(rows[0].count_value) : 1250;
    return { count, source: 'local_tracker' };
  } catch (err) {
    return { count: 1250, source: 'fallback' };
  }
}

// GET /api/visitor-count
router.get('/api/visitor-count', async (req, res) => {
  try {
    // Optionally track visit if session is new
    if (!req.session.hasCountedVisit) {
      req.session.hasCountedVisit = true;
      await ensureStatsTable();
      try {
        await pool.query(`
          UPDATE site_visitor_stats 
          SET count_value = count_value + 1 
          WHERE metric_name = 'total_pageviews'
        `);
      } catch (err) {
        console.error('[VISITOR STATS UPDATE ERROR]', err.message);
      }
    }

    const { count, source } = await getGAVisitorCount();
    const formattedCount = Number(count).toLocaleString('en-US');

    res.json({
      success: true,
      count,
      formattedCount,
      source
    });
  } catch (err) {
    console.error('[API VISITOR COUNT ERROR]', err);
    res.json({ success: true, count: 1250, formattedCount: '1,250', source: 'fallback' });
  }
});

// POST /api/visitor-count/increment
router.post('/api/visitor-count/increment', async (req, res) => {
  try {
    await ensureStatsTable();
    await pool.query(`
      UPDATE site_visitor_stats 
      SET count_value = count_value + 1 
      WHERE metric_name = 'total_pageviews'
    `);

    const { count, source } = await getGAVisitorCount();
    res.json({
      success: true,
      count,
      formattedCount: Number(count).toLocaleString('en-US'),
      source
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
