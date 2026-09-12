const fs = require('fs');
const path = require('path');

/**
 * Delete files older than maxAgeMs in the given directory.
 */
function cleanupOldFiles(dir, maxAgeMs) {
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  const entries = fs.readdirSync(dir);
  entries.forEach((file) => {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        console.log(`[CLEANUP] Deleted old file: ${filePath}`);
      }
    } catch (_) {}
  });
}

/**
 * Safely delete a single file, ignoring errors if it doesn't exist.
 */
function safeDeleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

/**
 * Resolve upload path safely, preventing path traversal.
 */
function safeUploadPath(baseDir, filename) {
  const resolved = path.resolve(baseDir, path.basename(filename));
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

/**
 * Format file size for display.
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * Generate a safe filename from a title string.
 */
function slugifyTitle(title) {
  return (title || 'document')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Returns a writable directory path. Vercel serverless environments are read-only
 * except for /tmp, so we use os.tmpdir() when running on Vercel.
 */
function getStorageDir(subPath) {
  const os = require('os');
  const base = process.env.VERCEL ? os.tmpdir() : path.join(__dirname, '../../');
  const target = path.join(base, subPath);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}

module.exports = { cleanupOldFiles, safeDeleteFile, safeUploadPath, formatFileSize, slugifyTitle, getStorageDir };
