const express = require('express');
const router = express.Router();
const googleAuthController = require('../controllers/googleAuthController');

/**
 * Bắt đầu OAuth Google — redirect sang accounts.google.com (public, không cần JWT).
 */
router.get('/google', googleAuthController.start);

/**
 * Callback Google — public; trao đổi code server-to-server; redirect về FE kèm token trong URL hash.
 */
router.get('/google/callback', googleAuthController.callback);

module.exports = router;
