const path = require('path');
const XLSX = require('xlsx');

// In-memory store: fileId → { type, filePath, originalName }
const uploadStore = new Map();

function storeFile(fileId, type, filePath, originalName) {
  uploadStore.set(fileId, { type, filePath, originalName, uploadedAt: new Date() });
}

function getUploadById(fileId) {
  return uploadStore.get(fileId) || null;
}

/**
 * POST /api/images/upload  – event photos
 */
async function uploadPhotos(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: true, message: 'No photos provided' });
    }

    const fileIds = req.files.map((f) => {
      const id = path.basename(f.filename, path.extname(f.filename));
      storeFile(id, 'photo', f.path, f.originalname);
      return { fileId: id, originalName: f.originalname, size: f.size };
    });

    res.json({ success: true, files: fileIds });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/invitation/upload  – invitation images
 */
async function uploadInvitationImages(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: true, message: 'No invitation images provided' });
    }

    const fileIds = req.files.map((f) => {
      const id = path.basename(f.filename, path.extname(f.filename));
      storeFile(id, 'invitation', f.path, f.originalname);
      return { fileId: id, originalName: f.originalname, size: f.size };
    });

    res.json({ success: true, files: fileIds });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/signature/upload  – multiple signatures
 */
async function uploadSignatures(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: true, message: 'No signature files provided' });
    }

    const fileIds = req.files.map((f) => {
      const id = path.basename(f.filename, path.extname(f.filename));
      storeFile(id, 'signature', f.path, f.originalname);
      return { fileId: id, originalName: f.originalname, size: f.size };
    });

    res.json({ success: true, files: fileIds });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/newspaper/upload  – multiple newspaper clippings
 */
async function uploadNewspapers(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: true, message: 'No newspaper clipping files provided' });
    }

    const fileIds = req.files.map((f) => {
      const id = path.basename(f.filename, path.extname(f.filename));
      storeFile(id, 'newspaper', f.path, f.originalname);
      return { fileId: id, originalName: f.originalname, size: f.size };
    });

    res.json({ success: true, files: fileIds });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadPhotos,
  uploadInvitationImages,
  uploadSignatures,
  uploadNewspapers,
  getUploadById,
};
