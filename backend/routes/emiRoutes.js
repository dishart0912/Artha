const express = require('express');
const router = express.Router();
const { addEMI, getEMIs, markInstallmentPaid, updateInstallmentAmount, deleteEMI } = require('../controllers/emiController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, addEMI)
  .get(protect, getEMIs);

router.route('/:id')
  .delete(protect, deleteEMI);

router.patch('/:id/installments/:installmentId/paid', protect, markInstallmentPaid);
router.patch('/:id/installments/:installmentId/amount', protect, updateInstallmentAmount);

module.exports = router;