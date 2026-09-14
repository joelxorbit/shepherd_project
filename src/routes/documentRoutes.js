const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // Allow up to 50MB total (Vercel payload limits will apply first)
});

// POST /api/document/generate-dynamic
router.post(
  '/generate-dynamic',
  upload.any(),
  documentController.generateDynamic
);

// GET /api/document/:id/download/docx
router.get('/:id/download/docx', documentController.downloadDocx);

// GET /api/document/:id/download/pdf
router.get('/:id/download/pdf', documentController.downloadPdf);

// GET /api/document/:id/status
router.get('/:id/status', documentController.getStatus);

module.exports = router;
