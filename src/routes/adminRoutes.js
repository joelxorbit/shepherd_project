const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TemplateConfig = require('../models/TemplateConfig');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-admin-key-shepherd';

// Setup multer for template docx uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/templates';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });
    req.userId = decoded.id;
    next();
  });
};

// ─── Admin Login ─────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Hardcoded credentials as requested
  if (username === 'sjctni' && password === '123') {
    const token = jwt.sign({ id: username }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, message: 'Login successful' });
  }

  res.status(401).json({ message: 'Invalid credentials' });
});

// ─── Template Config CRUD ────────────────────────────────────────────────────

// GET all templates
router.get('/templates', verifyToken, async (req, res) => {
  try {
    const templates = await TemplateConfig.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching templates', error: error.message });
  }
});

// GET single template by ID
router.get('/templates/:id', verifyToken, async (req, res) => {
  try {
    const template = await TemplateConfig.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching template', error: error.message });
  }
});

// CREATE new template config
router.post('/templates', verifyToken, upload.single('templateFile'), async (req, res) => {
  try {
    const configData = JSON.parse(req.body.config);
    const { templateName, description, steps } = configData;
    
    // Check if name exists
    const existing = await TemplateConfig.findOne({ templateName });
    if (existing) return res.status(400).json({ message: 'Template name already exists' });

    let templateFilename = null;
    let templateFileUrl = null;

    if (req.file) {
      templateFilename = req.file.originalname;
      templateFileUrl = '/' + req.file.path.replace(/\\/g, '/'); // ensure forward slashes
    }

    const newTemplate = new TemplateConfig({ 
      templateName, 
      description, 
      steps,
      templateFilename,
      templateFileUrl
    });
    
    await newTemplate.save();
    res.status(201).json(newTemplate);
  } catch (error) {
    res.status(500).json({ message: 'Error creating template', error: error.message });
  }
});

// UPDATE template config
router.put('/templates/:id', verifyToken, upload.single('templateFile'), async (req, res) => {
  try {
    const configData = JSON.parse(req.body.config);
    const { templateName, description, steps } = configData;
    
    const updateData = { templateName, description, steps };

    if (req.file) {
      updateData.templateFilename = req.file.originalname;
      updateData.templateFileUrl = '/' + req.file.path.replace(/\\/g, '/');
    }

    const updated = await TemplateConfig.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Template not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating template', error: error.message });
  }
});

// DELETE template config
router.delete('/templates/:id', verifyToken, async (req, res) => {
  try {
    const deleted = await TemplateConfig.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Template not found' });
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting template', error: error.message });
  }
});

module.exports = router;
