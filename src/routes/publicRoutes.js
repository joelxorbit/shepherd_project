const express = require('express');
const router = express.Router();
const TemplateConfig = require('../models/TemplateConfig');

// GET all templates for the public frontend
router.get('/templates', async (req, res) => {
  try {
    // Only return fields needed by frontend to keep payload small (excluding buffer)
    const templates = await TemplateConfig.find({}, { templateFileBuffer: 0 }).sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching templates', error: error.message });
  }
});

// GET download template file
router.get('/templates/:id/download', async (req, res) => {
  try {
    const template = await TemplateConfig.findById(req.params.id);
    if (!template || !template.templateFileBuffer) {
      return res.status(404).json({ message: 'Template file not found' });
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${template.templateFilename || 'template.docx'}"`);
    res.send(template.templateFileBuffer);
  } catch (error) {
    res.status(500).json({ message: 'Error downloading template', error: error.message });
  }
});

module.exports = router;
