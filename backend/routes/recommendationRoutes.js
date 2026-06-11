const express = require('express');
const router = express.Router();
const { getRecommendation } = require('../controllers/recommendationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getRecommendation);

module.exports = router;