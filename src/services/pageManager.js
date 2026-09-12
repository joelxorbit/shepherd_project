/**
 * pageManager.js
 *
 * Handles intelligent content overflow and page management.
 * Currently used to pre-process placeholder data before docxtemplater rendering.
 *
 * Future: integrate with docxtemplater loop tags for multi-page photo grids.
 */

/**
 * Given a list of photo paths and the number of photo placeholders in the template,
 * decide which photos go where and if we need to handle overflow.
 *
 * @param {string[]} photoPaths    - All uploaded photo paths
 * @param {number}   slotsInTemplate - How many {{PHOTO_N}} slots exist
 * @returns {{ assigned: {[key: string]: string}, overflow: string[] }}
 */
function assignPhotosToSlots(photoPaths, slotsInTemplate) {
  const assigned = {};
  const overflow = [];

  photoPaths.forEach((photoPath, idx) => {
    const slotNum = idx + 1;
    const key = `PHOTO_${slotNum}`;
    if (slotNum <= slotsInTemplate) {
      assigned[key] = photoPath;
    } else {
      overflow.push(photoPath);
    }
  });

  // Fill unfilled slots with null (will become empty string in template)
  for (let i = 1; i <= slotsInTemplate; i++) {
    const key = `PHOTO_${i}`;
    if (!assigned[key]) assigned[key] = null;
  }

  return { assigned, overflow };
}

/**
 * Split a long text block into chunks that fit within a rough character count.
 * Used for very long reports to determine if additional pages are needed.
 * (Note: actual page wrapping is handled by Word itself when the template has
 * page breaks. This is a logical split for very long texts.)
 *
 * @param {string} text
 * @param {number} charsPerPage - Approximate chars per page (default 3000)
 * @returns {string[]} Array of text chunks
 */
function splitTextIntoPages(text, charsPerPage = 3000) {
  if (!text || text.length <= charsPerPage) return [text];

  const pages = [];
  const paragraphs = text.split('\n');
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n' + para).length > charsPerPage && current.length > 0) {
      pages.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n' : '') + para;
    }
  }
  if (current) pages.push(current.trim());

  return pages;
}

module.exports = { assignPhotosToSlots, splitTextIntoPages };
