const express = require('express');
const router = express.Router();
const { addBankAccount, getBankAccounts, updateBankAccount, deleteBankAccount } = require('../controllers/bankAccountController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, addBankAccount)
    .get(protect, getBankAccounts);

router.route('/:id')
    .put(protect, updateBankAccount)
    .delete(protect, deleteBankAccount);

module.exports = router;