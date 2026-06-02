const express = require('express');
const rateLimit = require('express-rate-limit');
const geocodeController = require('../controllers/geocodeController');

const router = express.Router();

const geocodeLimiter = rateLimit({
    windowMs: 60_000,
    max: Math.max(10, parseInt(process.env.GEOCODE_SEARCH_MAX_PER_MINUTE, 10) || 60),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Quá nhiều yêu cầu tìm địa chỉ. Vui lòng thử lại sau.'
    }
});

router.get('/search', geocodeLimiter, geocodeController.search);
router.get('/place', geocodeLimiter, geocodeController.place);
router.get('/forward', geocodeLimiter, geocodeController.forward);
router.get('/reverse', geocodeLimiter, geocodeController.reverse);

module.exports = router;
