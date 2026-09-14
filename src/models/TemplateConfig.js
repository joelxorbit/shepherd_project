const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'rich_text', 'image'], required: true },
  placeholderMap: { type: String, required: true }, // e.g. EVENT_TITLE, REPORT, PHOTO_1
  hint: { type: String }
});

const stepSchema = new mongoose.Schema({
  stepNumber: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String },
  fields: [fieldSchema]
});

const templateConfigSchema = new mongoose.Schema({
  templateName: { type: String, required: true, unique: true },
  description: { type: String },
  templateFilename: { type: String }, // e.g. "student.docx"
  templateFileBuffer: { type: Buffer }, // Store binary data in DB for Vercel
  templateFileUrl: { type: String },  // We will keep this for backward compatibility or future use
  steps: [stepSchema]
}, { timestamps: true });

const TemplateConfig = mongoose.model('TemplateConfig', templateConfigSchema);

module.exports = TemplateConfig;
