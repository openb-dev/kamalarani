/**
 * Seed Thakurbari Radha Govinda Temple programmes for 2026–2027
 * Run: node migrations/seed_temple_events_2026.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../config/db');

const LOCATION_EN = 'Sri Sri Radha-Govinda Thakurbari, Natabari';
const LOCATION_BN = 'শ্রী শ্রী রাধা-গোবিন্দ ঠাকুরবাড়ি, নাটাবাড়ি';

const EVENTS = [
  {
    title: 'Jhulan Yatra of Lord Sri Krishna',
    title_bn: 'ভগবান শ্রীকৃষ্ণের ঝুলন যাত্রা অনুষ্ঠান',
    description:
      'Jhulan Yatra begins on Sunday, 23 August 2026 and concludes on Friday, 28 August 2026 at Radha Govinda Thakurbari.',
    description_bn:
      'ঝুলন যাত্রা অনুষ্ঠান শুরু হবে ২৩ আগস্ট ২০২৬ রবিবার এবং সমাপন হবে ২৮ আগস্ট ২০২৬ শুক্রবার। ঠাকুরবাড়ি রাধা গোবিন্দ মন্দিরের অনুষ্ঠান ২০২৬ সাল।',
    event_date: '2026-08-23 09:00:00',
    end_date: '2026-08-28 21:00:00'
  },
  {
    title: "Lord Sri Krishna's Birthday (Janmashtami)",
    title_bn: 'ভগবান শ্রীকৃষ্ণের জন্মদিন অনুষ্ঠান',
    description:
      'Special worship and abhishek of the Lord on Friday, 4 September 2026 at midnight (12:00 AM).',
    description_bn:
      'সেপ্টেম্বরের ৪ তারিখ শুক্রবার রাত্রি ১২:০০ টায় ভগবানের বিশেষ পূজা ও ভগবানের অভিষেক হবে।',
    event_date: '2026-09-04 00:00:00',
    end_date: null
  },
  {
    title: 'Radha Subha Janma — Birthday of Srimati Radharani',
    title_bn: 'রাধা শুভ জন্ম অনুষ্ঠান — রাধারানীর শুভ জন্ম',
    description:
      'Auspicious birthday celebration of Srimati Radharani on Saturday, 19 September 2026.',
    description_bn:
      '১৯শে সেপ্টেম্বর শনিবার রাধারানীর শুভ জন্ম অনুষ্ঠান অনুষ্ঠিত হবে।',
    event_date: '2026-09-19 09:00:00',
    end_date: null
  },
  {
    title: 'Kartik Month — Bhagavat Path & Nam Kirtan',
    title_bn: 'কার্তিক মাস — ভাগবত পাঠ ও নাম কীর্তন',
    description:
      'Kartik month begins on Monday, 19 October 2026 and continues until 17 November 2026. Throughout the month, Bhagavat path and nam kirtan will be held at Radha Govinda Thakurbari.',
    description_bn:
      'অক্টোবরের ১৯ তারিখ সোমবার থেকে কার্তিক মাস শুরু হবে এবং নভেম্বরের ১৭ তারিখে কার্তিক মাস শেষ হবে। পুরো কার্তিক মাস ঠাকুরবাড়ি রাধা গোবিন্দ মন্দিরে ভাগবত পাঠ এবং নাম কীর্তন অনুষ্ঠান হয়।',
    event_date: '2026-10-19 09:00:00',
    end_date: '2026-11-17 21:00:00'
  },
  {
    title: 'Kartik Vrat — Maha Bhog',
    title_bn: 'কার্তিক মাসের ব্রত উপলক্ষে মহা ভোগ',
    description:
      'Maha Bhog arranged on the occasion of Kartik month vrat on Tuesday, 18 November 2026.',
    description_bn:
      'নভেম্বরের ১৮ তারিখ কার্তিক মাসের ব্রত উপলক্ষে মহা ভোগের আয়োজন করা হয়।',
    event_date: '2026-11-18 09:00:00',
    end_date: null
  },
  {
    title: 'Maha Namyajna',
    title_bn: 'মহা নামযজ্ঞ অনুষ্ঠান',
    description:
      'Maha Namyajna begins on Thursday, 1 January 2027 at Radha Govinda Thakurbari.',
    description_bn:
      'ঠাকুরবাড়ি রাধা গোবিন্দ মন্দিরে জানুয়ারীর ১ তারিখ মহা নামযজ্ঞ অনুষ্ঠান শুরু হয়।',
    event_date: '2027-01-01 09:00:00',
    end_date: null
  }
];

async function ensureColumns(conn) {
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events'`
  );
  const existing = new Set(cols.map(c => c.COLUMN_NAME));
  const needed = [
    { name: 'title_bn', sql: 'ADD COLUMN title_bn VARCHAR(255) NULL AFTER title' },
    { name: 'description_bn', sql: 'ADD COLUMN description_bn TEXT NULL AFTER description' },
    { name: 'location_bn', sql: 'ADD COLUMN location_bn VARCHAR(500) NULL AFTER location' }
  ];
  for (const col of needed) {
    if (!existing.has(col.name)) {
      await conn.query(`ALTER TABLE events ${col.sql}`);
      console.log(`✓ Added column ${col.name}`);
    }
  }
}

async function run() {
  const conn = await pool.getConnection();
  try {
    await ensureColumns(conn);

    for (const ev of EVENTS) {
      const [rows] = await conn.query(
        'SELECT id FROM events WHERE title = ? AND DATE(event_date) = DATE(?) LIMIT 1',
        [ev.title, ev.event_date]
      );

      if (rows.length) {
        await conn.query(
          `UPDATE events SET
             title_bn = ?, description = ?, description_bn = ?,
             end_date = ?, location = ?, location_bn = ?, is_published = TRUE
           WHERE id = ?`,
          [
            ev.title_bn,
            ev.description,
            ev.description_bn,
            ev.end_date,
            LOCATION_EN,
            LOCATION_BN,
            rows[0].id
          ]
        );
        console.log(`↻ Updated: ${ev.title}`);
      } else {
        await conn.query(
          `INSERT INTO events
             (title, title_bn, description, description_bn, event_date, end_date, location, location_bn, is_published)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
          [
            ev.title,
            ev.title_bn,
            ev.description,
            ev.description_bn,
            ev.event_date,
            ev.end_date,
            LOCATION_EN,
            LOCATION_BN
          ]
        );
        console.log(`✓ Inserted: ${ev.title}`);
      }
    }

    console.log('\nTemple events seed complete.');
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
