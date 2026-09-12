const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { validateTemplate } = require('../utils/validation');
const templateController = require('../controllers/templateController');

// ── Multer setup for template uploads ─────────────────────────────────────────
const { getStorageDir } = require('../utils/fileUtils');

const storage = multer.diskStorage({
  destination: getStorageDir('uploads/templates'),
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}.docx`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_TEMPLATE_SIZE) || 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', // Some browsers send this for .docx
    ];
    // Also check extension as fallback
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || ext === '.docx') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx Word templates are supported'));
    }
  },
});

// POST /api/template/upload
router.post('/upload', upload.single('template'), templateController.uploadTemplate);

// GET /api/template/:id/placeholders
router.get('/:id/placeholders', templateController.getPlaceholders);

module.exports = router;
