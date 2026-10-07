const express = require('express');
const router = express.Router();
const reportColumnController = require('../controllers/reportColumnController');

// All endpoints might need auth in production, but for simplicity we match reportRoutes.js.
// reportRoutes doesn't seem to have auth middleware on its main endpoints right now.

router.get('/', reportColumnController.getColumns);
router.post('/', reportColumnController.createColumn);
router.put('/:id', reportColumnController.updateColumn);
router.delete('/:id', reportColumnController.deleteColumn);

module.exports = router;
