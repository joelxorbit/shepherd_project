require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { cleanupOldFiles, getStorageDir } = require('./src/utils/fileUtils');

const templateRoutes = require('./src/routes/templateRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const publicRoutes = require('./src/routes/publicRoutes');
const connectDB = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Connect to Database ───────────────────────────────────────────────────────
connectDB();

// ── Ensure directories exist (only for /tmp usage on local dev) ────────────────
const dirs = [
  'generated/docx',
];

dirs.forEach((dir) => getStorageDir(dir));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/template', templateRoutes);
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

app.listen(PORT, () => {
  console.log(`\n🚀 Document Automation Server running at http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Press Ctrl+C to stop\n`);
});

module.exports = app;
