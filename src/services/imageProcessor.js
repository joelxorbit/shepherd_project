const sharp = require('sharp');
const fs = require('fs');

/**
 * Process an image file to fit within given dimensions.
 * Returns a Buffer of the resized PNG.
 *
 * @param {string} filePath - Path to source image
 * @param {number} maxWidthPx - Maximum width in pixels
 * @param {number} maxHeightPx - Maximum height in pixels
 * @param {object} options
 * @param {string} options.fit - sharp fit mode: 'contain', 'cover', 'fill', 'inside', 'outside'
 * @param {string} options.background - Background color for contain mode (default white)
 * @returns {Promise<Buffer>} PNG buffer
 */
async function resizeImageToFit(filePath, maxWidthPx, maxHeightPx, options = {}) {
  const { fit = 'inside', background = { r: 255, g: 255, b: 255, alpha: 1 } } = options;

  const { data, info } = await sharp(filePath)
    .resize(maxWidthPx, maxHeightPx, {
      fit,
      withoutEnlargement: true,
      background,
    })
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  // Attach info so the generator can read the exact width/height
  data.info = info;
  return data;
}

/**
 * Read an image file as a Buffer (no resizing).
 */
async function readImageBuffer(filePath) {
  return fs.promises.readFile(filePath);
}

/**
 * Get image metadata (width, height) using sharp.
 */
async function getImageMetadata(filePath) {
  const meta = await sharp(filePath).metadata();
  return { width: meta.width, height: meta.height, format: meta.format };
}

/**
 * Convert centimetres to pixels at a given DPI.
 */
function cmToPx(cm, dpi = 96) {
  return Math.round((cm / 2.54) * dpi);
}

/**
 * Convert EMUs (English Metric Units, used in OOXML) to pixels.
 */
function emuToPx(emu, dpi = 96) {
  return Math.round((emu / 914400) * dpi);
}

module.exports = { resizeImageToFit, readImageBuffer, getImageMetadata, cmToPx, emuToPx };
