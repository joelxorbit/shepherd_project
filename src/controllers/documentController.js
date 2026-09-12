const path = require('path');
const fs = require('fs');
const { generateDocument } = require('../services/documentGenerator');
const { generateDocument } = require('../services/documentGenerator');
const { validateGenerateRequest } = require('../utils/validation');

/**
 * POST /api/document/generate
 * Expects multipart/form-data
 */
async function generate(req, res, next) {
  try {
    const body = req.body;
    
    if (!req.files || !req.files.template || !req.files.template[0]) {
      return res.status(400).json({ error: true, message: 'Template file is required.' });
    }

    // Helper to get buffers
    const getBuffers = (fieldname) => {
      if (req.files[fieldname]) {
        return req.files[fieldname].map(f => f.buffer);
      }
      return [];
    };

    const templateBuffer = req.files.template[0].buffer;
    const photoBuffers = getBuffers('photos');
    const invitationBuffers = getBuffers('invitation');
    const signatureBuffers = getBuffers('signature');
    const newspaperBuffers = getBuffers('newspaper');

    // Parse array fields that were sent as JSON strings in FormData
    let objectives = [];
    let outcomes = [];
    let customTextData = {};
    try {
      if (body.objectives) objectives = JSON.parse(body.objectives);
      if (body.outcomes) outcomes = JSON.parse(body.outcomes);
      if (body.customTextData) customTextData = JSON.parse(body.customTextData);
    } catch (e) {
      console.warn("Failed to parse JSON fields from FormData", e);
    }

    // For event photos: respect template slot count
    const photoPlaceholders = template.placeholders.filter((p) => p.name.match(/^PHOTO_\d+$/));
    // ── Build text data map ───────────────────────────────────────────────────
    const textData = {
      EVENT_TITLE:  body.eventTitle  || '',
      REPORT_TITLE: body.reportTitle || body.eventTitle || '',
      ...customTextData,
    };

    console.log(`[GENERATE] Starting all-in-one generation...`);

    const result = await generateDocument({
      templateBuffer,
      textData,
      photoBuffers,
      invitationBuffers,
      signatureBuffers,
      newspaperBuffers,
      objectives,
      outcomes,
      reportDescription: body.reportDescription || '',
      eventTitle: body.eventTitle || body.reportTitle || 'document',
    });

    console.log(`[GENERATE] Complete: ${result.filename}`);

    res.json({
      success: true,
      filename: result.filename,
      pdfFilename: result.pdfFilename,
      docxBase64: result.docxBase64,
      pdfBase64: result.pdfBase64,
    });
  } catch (err) {
    console.error('[GENERATE] Error:', err);

    if (err.properties && err.properties.errors) {
      const details = err.properties.errors
        .map((e) => `  • ${e.message} (tag: ${e.properties && e.properties.id})`)
        .join('\n');
      return res.status(422).json({
        error: true,
        message: `Template rendering failed:\n${details}\n\nCheck that your template placeholders use {{DOUBLE_BRACE}} syntax.`,
      });
    }

    next(err);
  }
}

module.exports = { generate };
