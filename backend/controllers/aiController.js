const axios = require('axios');
const Category = require('../models/Category');

// Python ML Microservice URL
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

/**
 * @desc    Predict mainCategory & subCategory dynamically for the logged-in user's categories
 * @route   POST /api/categories/predict
 * @access  Private
 */
const predictCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({
                message: 'Please provide a valid transaction name (minimum 2 characters).'
            });
        }

        const trimmedName = name.trim();

        // Fetch logged-in user's active categories from MongoDB
        let userCategories = [];
        if (req.user && req.user._id) {
            userCategories = await Category.find({ userId: req.user._id }).lean();
        }

        // ── Attempt 1: Call Python ML Microservice with Dynamic User Categories ──
        try {
            const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict-dynamic`, {
                name: trimmedName,
                userCategories
            }, { timeout: 2500 });

            if (mlResponse.data && mlResponse.data.success) {
                return res.status(200).json({
                    source: 'ml_model',
                    name: trimmedName,
                    mainCategory: mlResponse.data.mainCategory,
                    subCategory: mlResponse.data.subCategory,
                    confidence: mlResponse.data.confidence
                });
            }
        } catch (mlErr) {
            console.warn(`[AI Controller] ML Microservice unreachable at ${ML_SERVICE_URL}. Using fallback keyword matcher.`);
        }

        // ── Attempt 2: Smart Fallback Keyword Rule Matcher ─────────────────────
        const lowerName = trimmedName.toLowerCase();
        
        let mainCategory = 'Others';
        let subCategory = 'Others';
        let confidence = 0.70;

        if (/starbucks|blue tokai|chaayos|tea|coffee|cafe|ccd/i.test(lowerName)) {
            mainCategory = 'Food & Dining';
            subCategory = 'Cafe & Coffee Shops';
        } else if (/swiggy|zomato|eatclub|domino|pizza|burger|mcdonald|kfc|subway/i.test(lowerName)) {
            mainCategory = 'Food & Dining';
            subCategory = 'Food Delivery';
        } else if (/uber|ola|rapido|blusmart|cab|taxi/i.test(lowerName)) {
            mainCategory = 'Transportation';
            subCategory = 'Cabs & Rideshare';
        } else if (/petrol|diesel|fuel|shell|bpcl|hpcl|iocl/i.test(lowerName)) {
            mainCategory = 'Transportation';
            subCategory = 'Fuel & Gas';
        } else if (/blinkit|zepto|instamart|bigbasket|dmart|reliance fresh/i.test(lowerName)) {
            mainCategory = 'Groceries';
            subCategory = 'Quick Commerce';
        } else if (/amazon|flipkart|myntra|ajio|zara|h&m|uniqlo|croma/i.test(lowerName)) {
            mainCategory = 'Shopping';
            subCategory = 'Online Shopping';
        } else if (/apollo|pharmacy|1mg|pharmeasy|netmeds|hospital|doctor|lab/i.test(lowerName)) {
            mainCategory = 'Healthcare';
            subCategory = 'Pharmacy';
        } else if (/netflix|spotify|pvr|cinemas|hotstar|youtube|bookmyshow/i.test(lowerName)) {
            mainCategory = 'Entertainment';
            subCategory = 'Streaming Services';
        } else if (/airtel|jio|broadband|wifi|recharge|electricity|bescom|msedcl/i.test(lowerName)) {
            mainCategory = 'Bills & Utilities';
            subCategory = 'Mobile Recharge';
        }

        return res.status(200).json({
            source: 'rule_fallback',
            name: trimmedName,
            mainCategory,
            subCategory,
            confidence
        });

    } catch (error) {
        console.error('Error in predictCategory:', error);
        return res.status(500).json({
            message: 'Server error during category prediction',
            error: error.message
        });
    }
};

/**
 * @desc    Scan receipt image/PDF, run OpenCV+OCR+Parsing+Matching, return itemized items
 * @route   POST /api/categories/scan-receipt
 * @access  Private
 */
const scanReceipt = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a valid receipt file (PDF or image).' });
        }

        // Fetch logged-in user's active categories from MongoDB
        let userCategories = [];
        if (req.user && req.user._id) {
            userCategories = await Category.find({ userId: req.user._id }).lean();
        }

        // Determine filename with proper extension
        let filename = req.file.originalname || 'receipt.pdf';
        const isPdf = req.file.mimetype === 'application/pdf' || 
                      (req.file.buffer && req.file.buffer.slice(0, 4).toString() === '%PDF');
        
        if (isPdf && !filename.toLowerCase().endsWith('.pdf')) {
            filename += '.pdf';
        }

        // Use form-data package to build proper multipart request with boundary header
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', req.file.buffer, {
            filename: filename,
            contentType: req.file.mimetype || 'application/pdf'
        });
        form.append('userCategories', JSON.stringify(userCategories));

        const targetUrl = `${ML_SERVICE_URL}/scan-receipt`;
        console.log(`[EXPRESS -> ML] Step 1: Dispatching request to target URL: ${targetUrl}`);
        console.log(`[EXPRESS -> ML] Step 2: Payload file='${filename}', bufferSize=${req.file.buffer?.length || 0} bytes`);

        const mlResponse = await axios.post(targetUrl, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 65000
        });

        console.log(`[EXPRESS -> ML] Step 3: Received response from ML service with status ${mlResponse.status}`);

        if (mlResponse.data && mlResponse.data.success) {
            return res.status(200).json(mlResponse.data);
        } else {
            console.error('[AI Controller] ML service returned success=false:', mlResponse.data);
            return res.status(500).json({ message: mlResponse.data?.error || 'Receipt scanning returned an invalid response.' });
        }
    } catch (error) {
        console.error('[AI Controller] Error in scanReceipt:', error.message);
        let downstreamError = error.message;
        
        if (error.response) {
            console.error('[AI Controller] ML Service Error Response Data:', JSON.stringify(error.response.data));
            console.error('[AI Controller] ML Service Error Status:', error.response.status);
            downstreamError = error.response.data?.error || error.response.data?.message || downstreamError;
        }
        
        return res.status(500).json({
            message: downstreamError,
            error: downstreamError,
            details: error.response?.data
        });
    }
};

module.exports = {
    predictCategory,
    scanReceipt
};
