const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const uploadController = require('../controllers/uploadController');
const { getStorageDir } = require('../utils/fileUtils');

// ── Helper: create a multer instance for a given subdirectory ─────────────────
function createUploader(subdir, maxSize, allowedMimes) {
  const storage = multer.diskStorage({
    destination: getStorageDir('uploads/' + subdir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedMimes.includes(file.mimetype) || allowedMimes.some((m) => ext === `.${m.split('/')[1]}`)) {
        cb(null, true);
      } else {
        cb(new Error(`File type not allowed: ${file.mimetype}`));
      }
    },
  });
}

const MAX_IMAGE = parseInt(process.env.MAX_IMAGE_SIZE) || 10 * 1024 * 1024;
const IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const photoUploader       = createUploader('photos',     MAX_IMAGE, IMAGE_MIMES);
const invitationUploader  = createUploader('photos',     MAX_IMAGE, IMAGE_MIMES); // reuse photos dir
const signatureUploader   = createUploader('signatures', MAX_IMAGE, IMAGE_MIMES);
const newspaperUploader   = createUploader('newspapers', MAX_IMAGE, IMAGE_MIMES);

// POST /api/images/upload  – event photos (up to 20)
router.post('/images/upload', photoUploader.array('photos', 20), uploadController.uploadPhotos);

// POST /api/invitation/upload  – invitation images (up to 10)
router.post('/invitation/upload', invitationUploader.array('invitation', 10), uploadController.uploadInvitationImages);

// POST /api/signature/upload  – multiple signatures (up to 10)
router.post('/signature/upload', signatureUploader.array('signature', 10), uploadController.uploadSignatures);

// POST /api/newspaper/upload  – multiple newspaper clippings (up to 10)
router.post('/newspaper/upload', newspaperUploader.array('newspaper', 10), uploadController.uploadNewspapers);

module.exports = router;
