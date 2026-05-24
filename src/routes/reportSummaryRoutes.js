const express = require('express');
const router = express.Router();
const reportSummaryController = require('../controllers/reportSummaryController');
const { authenticate, requireAdminOrModerator } = require('../middleware/auth');

/**
 * GET /api/reports/summary — thống kê auto-approve (Admin/Moderator)
 */
router.get(
    '/summary',
    authenticate,
    requireAdminOrModerator,
    reportSummaryController.getSummary
);

module.exports = router;
