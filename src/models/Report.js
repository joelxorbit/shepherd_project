const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  villageName: {
    type: String,
    trim: true,
  },
  issue: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    trim: true,
  }
}, {
  timestamps: true,
  collection: 'report',
  strict: false
});

module.exports = mongoose.model('Report', reportSchema);
