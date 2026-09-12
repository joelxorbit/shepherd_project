const path = require('path');
const fs = require('fs');
const { generateDocument } = require('../services/documentGenerator');
const { getTemplateById } = require('./templateController');
const { getUploadById } = require('./uploadController');
const { validateGenerateRequest } = require('../utils/validation');
const { assignPhotosToSlots } = require('../services/pageManager');
const { getStorageDir } = require('../utils/fileUtils');

const GENERATED_DOCX_DIR = getStorageDir('generated/docx');

// In-memory job store: jobId → { status, docxPath, filename }
const jobStore = new Map();

/**
 * POST /api/document/generate
 *
 * Expected JSON body:
 * {
 *   templateId: string,
 *   eventTitle: string,
 *   reportTitle: string,
 *   objectives: string[],
 *   reportDescription: string,         // HTML from Quill
 *   outcomes: string[],
 *   photoFileIds: string[],             // ordered event photos
 *   invitationFileIds: string[],        // ordered invitation images
 *   signatureFileIds: string[],         // ordered signatures
 *   newspaperFileIds: string[],         // ordered newspaper clippings
 *   customTextData: object,             // extra {{PLACEHOLDER}} → value pairs
 * }
 */
async function generate(req, res, next) {
  try {
    const body = req.body;

    // ── Validate ──────────────────────────────────────────────────────────────
    const errors = validateGenerateRequest(body);
    if (errors.length > 0) {
      return res.status(400).json({ error: true, messages: errors });
    }

    const template = getTemplateById(body.templateId);
    if (!template) {
      return res.status(404).json({
        error: true,
        message: 'Template not found on server. Please re-upload your Word template.',
      });
    }

    // ── Helper: resolve an ordered array of file IDs → file paths ─────────────
    function resolveFilePaths(fileIds) {
      if (!Array.isArray(fileIds)) return [];
      return fileIds
        .map((id) => {
          const upload = getUploadById(id);
          return upload ? upload.filePath : null;
        })
        .filter(Boolean);
    }

    // ── Resolve all image arrays ───────────────────────────────────────────────
    const photoFilePaths = resolveFilePaths(body.photoFileIds);

    // For event photos: respect template slot count
    const photoPlaceholders = template.placeholders.filter((p) => p.name.match(/^PHOTO_\d+$/));
    const { assigned: assignedPhotos } = assignPhotosToSlots(photoFilePaths, photoPlaceholders.length);
    const maxSlot = Math.max(photoFilePaths.length, photoPlaceholders.length);
    const orderedPhotoPaths = [];
    for (let i = 1; i <= maxSlot; i++) {
      const p = assignedPhotos[`PHOTO_${i}`];
      if (p) orderedPhotoPaths.push(p);
    }

    const invitationFilePaths = resolveFilePaths(body.invitationFileIds);
    const signatureFilePaths  = resolveFilePaths(body.signatureFileIds);
    const newspaperFilePaths  = resolveFilePaths(body.newspaperFileIds);

    // ── Build text data map ───────────────────────────────────────────────────
    const textData = {
      EVENT_TITLE:  body.eventTitle  || '',
      REPORT_TITLE: body.reportTitle || body.eventTitle || '',
      ...(body.customTextData || {}),
    };

    // ── Generate document ─────────────────────────────────────────────────────
    console.log(`[GENERATE] Starting for template: ${body.templateId}`);
    console.log(`[GENERATE] Photos: ${orderedPhotoPaths.length}, Invitations: ${invitationFilePaths.length}, Sigs: ${signatureFilePaths.length}, News: ${newspaperFilePaths.length}`);

    const result = await generateDocument({
      templatePath: template.filePath,
      textData,
      photoFilePaths: orderedPhotoPaths,
      invitationFilePaths,
      signatureFilePaths,
      newspaperFilePaths,
      objectives: body.objectives || [],
      outcomes: body.outcomes || [],
      reportDescription: body.reportDescription || '',
      eventTitle: body.eventTitle || body.reportTitle || 'document',
      placeholderManifest: template.placeholders,
    });

    // Store job
    jobStore.set(result.jobId, {
      status: 'complete',
      docxPath: result.docxPath,
      pdfPath: result.pdfPath,
      filename: result.filename,
      pdfFilename: result.pdfFilename,
      createdAt: new Date(),
    });

    console.log(`[GENERATE] Complete: ${result.filename} (job: ${result.jobId})`);

    res.json({
      success: true,
      jobId: result.jobId,
      filename: result.filename,
      pdfFilename: result.pdfFilename,
      docxUrl: `/api/document/${result.jobId}/download/docx`,
      pdfUrl: result.pdfPath ? `/api/document/${result.jobId}/download/pdf` : null,
    });
  } catch (err) {
    console.error('[GENERATE] Error:', err);

    // Provide docxtemplater-specific error messages
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

/**
 * GET /api/document/:id/download/docx
 */
async function downloadDocx(req, res, next) {
  try {
    const job = jobStore.get(req.params.id);

    if (!job) {
      return res.status(404).json({ error: true, message: 'Document not found. It may have expired.' });
    }
    if (!fs.existsSync(job.docxPath)) {
      return res.status(404).json({ error: true, message: 'Generated file not found on server.' });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    res.sendFile(path.resolve(job.docxPath));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/document/:id/download/pdf
 */
async function downloadPdf(req, res, next) {
  try {
    const job = jobStore.get(req.params.id);

    if (!job) {
      return res.status(404).json({ error: true, message: 'Document not found. It may have expired.' });
    }
    if (!job.pdfPath || !fs.existsSync(job.pdfPath)) {
      return res.status(404).json({ error: true, message: 'Generated PDF not found on server.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${job.pdfFilename}"`);
    res.sendFile(path.resolve(job.pdfPath));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/document/:id/status
 */
async function getStatus(req, res, next) {
  try {
    const job = jobStore.get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: true, message: 'Job not found' });
    }
    res.json({ jobId: req.params.id, status: job.status, filename: job.filename });
  } catch (err) {
    next(err);
  }
}

module.exports = { generate, downloadDocx, downloadPdf, getStatus };
