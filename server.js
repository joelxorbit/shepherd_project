require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { cleanupOldFiles, getStorageDir } = require('./src/utils/fileUtils');

const templateRoutes = require('./src/routes/templateRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const documentRoutes = require('./src/routes/documentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Ensure directories exist ────────────────────────────────────────────────
const dirs = [
  'generated/docx',
  'uploads/templates',
  'uploads/photos',
  'uploads/signatures',
  'uploads/newspapers',
];

dirs.forEach((dir) => getStorageDir(dir));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/template', templateRoutes);
app.use('/api', uploadRoutes);
app.use('/api/document', documentRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Serve frontend for all non-API routes ────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: true,
    message: err.message || 'Internal server error',
  });
});

// ─── Scheduled cleanup: delete generated files older than TTL ─────────────────
const ttl = parseInt(process.env.GENERATED_FILE_TTL) || 3600000;
cron.schedule('*/30 * * * *', () => {
  cleanupOldFiles(getStorageDir('generated/docx'), ttl);
  cleanupOldFiles(getStorageDir('uploads/templates'), ttl);
  cleanupOldFiles(getStorageDir('uploads/photos'), ttl * 4);
  cleanupOldFiles(getStorageDir('uploads/signatures'), ttl * 4);
  cleanupOldFiles(getStorageDir('uploads/newspapers'), ttl * 4);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Document Automation Server running at http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Press Ctrl+C to stop\n`);
});

module.exports = app;
