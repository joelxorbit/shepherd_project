const path = require('path');
const { parseTemplateBuffer } = require('../services/templateParser');

/**
 * POST /api/template/parse
 * Extracts placeholders from a template buffer and discards the buffer.
 */
async function parseTemplateEndpoint(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: true, message: 'No template file provided' });
    }

    // Parse placeholders from memory
    const { placeholders } = await parseTemplateBuffer(req.file.buffer);

    console.log(`[TEMPLATE PARSE] Parsed: ${req.file.originalname}`);
    console.log(`[TEMPLATE PARSE] Found ${placeholders.length} placeholder(s)`);

    res.json({
      success: true,
      filename: req.file.originalname,
      size: req.file.size,
      placeholders,
    });
  } catch (err) {
    if (err.message.includes('End of data reached') || err.message.includes('Invalid')) {
      return res.status(400).json({ error: true, message: 'Invalid or corrupted .docx file' });
    }
    next(err);
  }
}

module.exports = { parseTemplateEndpoint };
