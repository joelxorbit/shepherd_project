const path = require('path');
const fs = require('fs');
const { generateDocument } = require('../services/documentGenerator');
const TemplateConfig = require('../models/TemplateConfig');

/**
 * POST /api/document/generate-dynamic
 * Expects multipart/form-data
 */
async function generateDynamic(req, res, next) {
  try {
    const { templateId, dynamicTextData } = req.body;
    
    if (!templateId) {
      return res.status(400).json({ error: true, message: 'templateId is required.' });
    }

    const templateConfig = await TemplateConfig.findById(templateId);
    if (!templateConfig || !templateConfig.templateFileBuffer) {
      return res.status(400).json({ error: true, message: 'Template not found or has no uploaded .docx file.' });
    }

    // Use the .docx buffer stored in MongoDB directly
    const templateBuffer = templateConfig.templateFileBuffer;

    // Group req.files into dynamicImageBuffers
    const dynamicImageBuffers = {};
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (!dynamicImageBuffers[file.fieldname]) {
          dynamicImageBuffers[file.fieldname] = [];
        }
        dynamicImageBuffers[file.fieldname].push(file.buffer);
      });
    }

    let parsedTextData = {};
    try {
      if (dynamicTextData) parsedTextData = JSON.parse(dynamicTextData);
    } catch (e) {
      console.warn("Failed to parse dynamicTextData", e);
    }

    console.log(`[GENERATE] Starting dynamic generation for ${templateConfig.templateName}...`);

    const result = await generateDocument({
      templateBuffer,
      dynamicTextData: parsedTextData,
      dynamicImageBuffers,
      eventTitle: parsedTextData.EVENT_TITLE || parsedTextData.REPORT_TITLE || templateConfig.templateName,
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

async function downloadDocx(req, res, next) {
  res.status(501).json({ message: 'Not implemented' });
}

async function downloadPdf(req, res, next) {
  res.status(501).json({ message: 'Not implemented' });
}

async function getStatus(req, res, next) {
  res.status(501).json({ message: 'Not implemented' });
}

module.exports = { 
  generateDynamic, 
  downloadDocx, 
  downloadPdf, 
  getStatus 
};
