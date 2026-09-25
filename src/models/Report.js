const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  villageName: {
    type: String,
    required: true,
    trim: true,
  },
  issue: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    trim: true,
  }
}, {
  timestamps: true,
  collection: 'report'
});

module.exports = mongoose.model('Report', reportSchema);
