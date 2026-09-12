const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

// POST /api/document/generate
router.post('/generate', documentController.generate);

// GET /api/document/:id/download/docx
router.get('/:id/download/docx', documentController.downloadDocx);

// GET /api/document/:id/download/pdf
router.get('/:id/download/pdf', documentController.downloadPdf);

// GET /api/document/:id/status
router.get('/:id/status', documentController.getStatus);

module.exports = router;
