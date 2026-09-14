const express = require('express');
const router = express.Router();
const TemplateConfig = require('../models/TemplateConfig');

// GET all templates for the public frontend
router.get('/templates', async (req, res) => {
  try {
    const templates = await TemplateConfig.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching templates', error: error.message });
  }
});

module.exports = router;
