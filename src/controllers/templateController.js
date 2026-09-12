const path = require('path');
const { parseTemplate, validateDocxFile } = require('../services/templateParser');

// In-memory store: templateId → { filePath, originalName, placeholders }
// In production, replace with a database or Redis store
const templateStore = new Map();

/**
 * POST /api/template/upload
 */
async function uploadTemplate(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No template file provided' });
    }

    const filePath = req.file.path;
    const templateId = path.basename(req.file.filename, '.docx');

    // Validate the DOCX structure
    try {
      validateDocxFile(filePath);
    } catch (err) {
      return res.status(400).json({ error: true, message: err.message });
    }

    // Parse placeholders
    const { placeholders } = await parseTemplate(filePath);

    // Store reference
    templateStore.set(templateId, {
      filePath,
      originalName: req.file.originalname,
      size: req.file.size,
      placeholders,
      uploadedAt: new Date(),
    });

    console.log(`[TEMPLATE] Uploaded: ${req.file.originalname} → ${templateId}`);
    console.log(`[TEMPLATE] Found ${placeholders.length} placeholder(s):`, placeholders.map((p) => p.token).join(', '));

    res.json({
      success: true,
      templateId,
      filename: req.file.originalname,
      size: req.file.size,
      placeholders,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/template/:id/placeholders
 */
async function getPlaceholders(req, res, next) {
  try {
    const { id } = req.params;
    const template = templateStore.get(id);

    if (!template) {
      return res.status(404).json({ error: true, message: 'Template not found. Please re-upload.' });
    }

    res.json({ success: true, templateId: id, placeholders: template.placeholders });
  } catch (err) {
    next(err);
  }
}

/**
 * Get template info by ID (used internally by documentController).
 */
function getTemplateById(id) {
  return templateStore.get(id) || null;
}

module.exports = { uploadTemplate, getPlaceholders, getTemplateById };
