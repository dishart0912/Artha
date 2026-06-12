const express = require('express');
const router = express.Router();
const { addReceivable, getReceivables, markReceived, deleteReceivable } = require('../controllers/receivableController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, addReceivable)
  .get(protect, getReceivables);

router.route('/:id')
  .delete(protect, deleteReceivable);

router.patch('/:id/received', protect, markReceived);

module.exports = router;