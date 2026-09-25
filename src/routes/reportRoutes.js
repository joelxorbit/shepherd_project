const express = require('express');
const multer = require('multer');
const path = require('path');
const reportController = require('../controllers/reportController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Appending extension
  }
});
const upload = multer({ storage: storage });

router.get('/', reportController.getReports);
router.post('/', reportController.addReport);
router.put('/:id', reportController.updateReport);
router.delete('/:id', reportController.deleteReport);
router.post('/import', upload.single('file'), reportController.importExcel);

module.exports = router;
