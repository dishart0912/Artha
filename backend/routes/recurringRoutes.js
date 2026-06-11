const express = require('express');
const router = express.Router();
const { addRecurring, getRecurring, markPaid, markUnpaid, deleteRecurring } = require('../controllers/recurringController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, addRecurring)
    .get(protect, getRecurring);

router.route('/:id')
    .delete(protect, deleteRecurring);

router.patch('/:id/paid',   protect, markPaid);
router.patch('/:id/unpaid', protect, markUnpaid);

module.exports = router;