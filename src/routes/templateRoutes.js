const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const templateController = require('../controllers/templateController');

const upload = multer({
  storage: multer.memoryStorage(),
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

// POST /api/template/parse
router.post('/parse', upload.single('template'), templateController.parseTemplateEndpoint);

module.exports = router;
