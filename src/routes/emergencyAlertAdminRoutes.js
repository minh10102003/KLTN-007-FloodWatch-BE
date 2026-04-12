const express = require('express');
const router = express.Router();
const emergencyAlertStatsController = require('../controllers/emergencyAlertStatsController');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/admin/emergency-alerts/summary:
 *   get:
 *     summary: Thống kê gửi cảnh báo khẩn thành công (đã ghi log dedupe)
 *     tags: [Emergency Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema: { type: integer, default: 24, minimum: 1, maximum: 168 }
 *     responses:
 *       200:
 *         description: Thành công
 *       403:
 *         description: Chỉ admin
 */
router.get(
    '/v1/admin/emergency-alerts/summary',
    authenticate,
    requireAdmin,
    emergencyAlertStatsController.getSummary
);

module.exports = router;
