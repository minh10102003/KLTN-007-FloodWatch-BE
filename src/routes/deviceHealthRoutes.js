const express = require('express');
const router = express.Router();
const deviceHealthController = require('../controllers/deviceHealthController');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/admin/devices/health:
 *   get:
 *     summary: Sức khỏe / telemetry tổng quan thiết bị (Admin)
 *     tags: [Device Health]
 *     description: |
 *       Trạng thái `online` | `degraded` | `offline` | `inactive` dựa trên `last_data_time` và ngưỡng phút (env `HEALTH_ONLINE_MAX_MINUTES`, `HEALTH_DEGRADED_MAX_MINUTES`).
 *       Kèm lần đo flood_logs và energy_logs gần nhất. Chỉ **admin**.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *       403:
 *         description: Không phải admin
 */
router.get(
    '/v1/admin/devices/health',
    authenticate,
    requireAdmin,
    deviceHealthController.getDevicesHealth
);

module.exports = router;
