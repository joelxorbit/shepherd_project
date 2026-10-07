const mongoose = require('mongoose');

const reportColumnSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // camelCase e.g., 'villageName', 'issue', 'status', 'customField'
  label: { type: String, required: true }, // e.g., 'Village Name'
  order: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false },
  inputType: { type: String, default: 'text' }, // 'text', 'select'
  options: { type: String, default: '' } // comma-separated options for 'select'
}, { timestamps: true });

module.exports = mongoose.model('ReportColumn', reportColumnSchema);
