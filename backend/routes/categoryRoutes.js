const express = require('express');
const router = express.Router();
const { 
    getCategories, 
    addCategory, 
    deleteCategory, 
    updateCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    bulkDeleteCategories
} = require('../controllers/categoryController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { predictCategory, scanReceipt } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getCategories)
    .post(protect, addCategory);

router.route('/predict')
    .post(protect, predictCategory);

router.route('/scan-receipt')
    .post(protect, upload.single('file'), scanReceipt);

router.route('/bulk-delete')
    .post(protect, bulkDeleteCategories);

router.route('/:name')
    .delete(protect, deleteCategory)
    .put(protect, updateCategory);

router.route('/:name/subcategories')
    .post(protect, addSubcategory);

router.route('/:name/subcategories/:subName')
    .put(protect, updateSubcategory)
    .delete(protect, deleteSubcategory);

module.exports = router;
