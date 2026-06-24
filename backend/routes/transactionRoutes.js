const express = require('express');
const router = express.Router();
const { addTransaction, getTransactions, updateTransaction, deleteTransaction, payCardBill } = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, addTransaction)
    .get(protect, getTransactions);

router.route('/pay-bill')
    .post(protect, payCardBill);

router.route('/:id')
    .put(protect, updateTransaction)
    .delete(protect, deleteTransaction);

module.exports = router;