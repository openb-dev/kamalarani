/**
 * utils/imageProcessor.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared image processing pipeline for all uploads (gallery + admissions).
 *
 * Pipeline (senior-approved):
 *   1. Check orientation  → auto-rotate from EXIF so photo is right-side-up
 *   2. Resize             → always fit within 1920×1080 (landscape)
 *                           or 1080×1920 (portrait), whichever matches aspect
 *   3. Check size > 3 MB  → if the resized JPEG is over 3 MB, compress
 *   4. Compress           → reduce JPEG quality (85 → 20, step −10) until ≤ 3 MB
 *   5. Upload             → return processed buffer to the route for saving
 *
 * UI shows "Max 5 MB" so users aren't confused by the accept limit,
 * but the internal storage target is always 3 MB.
 *
 * PDFs: caller must enforce their own size check — this util is images-only.
 */

'use strict';

const sharp = require('sharp');

const TARGET_BYTES     = 3 * 1024 * 1024;   // 3 MB internal storage target
const LANDSCAPE_W      = 1920;
const LANDSCAPE_H      = 1080;
const PORTRAIT_W       = 1080;
const PORTRAIT_H       = 1920;

/**
 * Full image processing pipeline.
 *
 * @param  {Buffer} buffer  Raw image buffer from multer memoryStorage
 * @returns {Promise<Buffer>} Processed JPEG buffer (≤ 3 MB best effort)
 */
async function processImage(buffer) {
  // ── Step 1 & 2: Orient + Resize ───────────────────────────────────────────
  // Read metadata first to detect portrait vs landscape orientation
  const meta = await sharp(buffer).rotate().metadata(); // .rotate() applies EXIF first
  const isPortrait = (meta.height || 0) > (meta.width || 0);

  const maxW = isPortrait ? PORTRAIT_W  : LANDSCAPE_W;
  const maxH = isPortrait ? PORTRAIT_H  : LANDSCAPE_H;

  // Always resize to fit within the target bounds (never upscale)
  const resized = await sharp(buffer)
    .rotate()                                           // Step 1: correct orientation
    .resize(maxW, maxH, {                               // Step 2: resize to max bounds
      fit: 'inside',
      withoutEnlargement: true                          // don't upscale small images
    })
    .jpeg({ quality: 90 })                              // output JPEG at high quality
    .toBuffer();

  const origKB    = (buffer.length   / 1024).toFixed(0);
  const resizedKB = (resized.length  / 1024).toFixed(0);

  // ── Step 3: Check size ────────────────────────────────────────────────────
  if (resized.length <= TARGET_BYTES) {
    console.log(`[IMAGE] orient+resize: ${origKB} KB → ${resizedKB} KB ✅ (≤3 MB, no compression needed)`);
    return resized;                                     // Step 5: ready to upload
  }

  // ── Step 4: Compress ──────────────────────────────────────────────────────
  // Re-use the already-resized dimensions; only reduce quality
  const resizedMeta = await sharp(resized).metadata();
  let quality = 85;

  while (quality >= 20) {
    const compressed = await sharp(resized)
      .jpeg({ quality })
      .toBuffer();

    if (compressed.length <= TARGET_BYTES) {
      console.log(
        `[IMAGE] orient+resize: ${origKB} KB → ${resizedKB} KB, ` +
        `compress q${quality}: ${(compressed.length / 1024).toFixed(0)} KB ✅`
      );
      return compressed;                                // Step 5: ready to upload
    }
    quality -= 10;
  }

  // Best effort — quality=20 is already very compressed; extremely dense source
  const fallback = await sharp(resized).jpeg({ quality: 20 }).toBuffer();
  console.warn(
    `[IMAGE] Best effort q20: ${(fallback.length / 1024).toFixed(0)} KB ` +
    `(could not reach 3 MB target for a ${origKB} KB source)`
  );
  return fallback;
}

module.exports = { processImage, TARGET_BYTES };
