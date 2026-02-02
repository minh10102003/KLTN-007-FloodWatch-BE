const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Lấy tất cả alerts (có filter)
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, acknowledged, resolved]
 *         description: Lọc theo trạng thái
 *         example: active
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Lọc theo mức độ nghiêm trọng
 *         example: critical
 *       - in: query
 *         name: alert_type
 *         schema:
 *           type: string
 *           enum: [warning, danger, offline, velocity_spike]
 *         description: Lọc theo loại alert
 *         example: danger
 *       - in: query
 *         name: sensor_id
 *         schema:
 *           type: string
 *         description: Lọc theo sensor ID
 *         example: S01
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           minimum: 1
 *           maximum: 1000
 *         description: Số lượng alerts tối đa
 *         example: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Số lượng bỏ qua (cho pagination)
 *         example: 0
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Alert'
 */
router.get('/', authenticate, alertController.getAllAlerts);

/**
 * @swagger
 * /api/alerts/active:
 *   get:
 *     summary: Lấy alerts đang active
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           minimum: 1
 *           maximum: 1000
 *         description: Số lượng alerts tối đa
 *         example: 100
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Lọc theo mức độ nghiêm trọng
 *         example: critical
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Alert'
 */
router.get('/active', authenticate, alertController.getActiveAlerts);

/**
 * @swagger
 * /api/alerts/stats:
 *   get:
 *     summary: Thống kê alerts theo trạng thái
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *           minimum: 1
 *           maximum: 30
 *         description: Số ngày gần đây để thống kê
 *         example: 7
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       status:
 *                         type: string
 *                         example: active
 *                       count:
 *                         type: integer
 *                         example: 5
 */
router.get('/stats', authenticate, alertController.getAlertStats);

/**
 * @swagger
 * /api/alerts/{alertId}:
 *   get:
 *     summary: Lấy alert theo ID
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của alert
 *         example: 1
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Alert'
 *       404:
 *         description: Alert không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:alertId', authenticate, alertController.getAlertById);

/**
 * @swagger
 * /api/alerts/{alertId}/acknowledge:
 *   put:
 *     summary: Xác nhận alert (đã xem)
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của alert
 *         example: 1
 *     responses:
 *       200:
 *         description: Đã xác nhận alert
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Đã xác nhận alert
 *                 data:
 *                   $ref: '#/components/schemas/Alert'
 *       404:
 *         description: Alert không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:alertId/acknowledge', authenticate, alertController.acknowledgeAlert);

/**
 * @swagger
 * /api/alerts/{alertId}/resolve:
 *   put:
 *     summary: Đánh dấu alert đã xử lý
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của alert
 *         example: 1
 *     responses:
 *       200:
 *         description: Đã đánh dấu alert đã xử lý
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Đã đánh dấu alert đã xử lý
 *                 data:
 *                   $ref: '#/components/schemas/Alert'
 *       404:
 *         description: Alert không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:alertId/resolve', authenticate, alertController.resolveAlert);

module.exports = router;

