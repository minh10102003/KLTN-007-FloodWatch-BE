const express = require('express');
const router = express.Router();
const otaController = require('../controllers/otaController');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/ota:
 *   post:
 *     summary: Tạo OTA update mới (Admin only)
 *     tags: [OTA Updates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sensor_id
 *               - firmware_version
 *               - firmware_url
 *             properties:
 *               sensor_id:
 *                 type: string
 *                 example: S01
 *               firmware_version:
 *                 type: string
 *                 example: v2.0.0
 *               firmware_url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/firmware.bin
 *               checksum:
 *                 type: string
 *                 example: abc123def456
 *               scheduled_at:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-12-25T10:00:00Z
 *     responses:
 *       201:
 *         description: Tạo OTA update thành công
 *       400:
 *         description: Thiếu thông tin bắt buộc
 *       403:
 *         description: Chỉ admin mới có quyền
 */
router.post('/', authenticate, requireAdmin, otaController.createOtaUpdate);

/**
 * @swagger
 * /api/ota/pending:
 *   get:
 *     summary: Lấy OTA updates đang pending (Admin only)
 *     tags: [OTA Updates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 200
 *         description: Số lượng OTA updates tối đa
 *         example: 50
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
 *                       id:
 *                         type: integer
 *                       sensor_id:
 *                         type: string
 *                       firmware_version:
 *                         type: string
 *                       update_status:
 *                         type: string
 *                       scheduled_at:
 *                         type: string
 *                         format: date-time
 *       403:
 *         description: Chỉ admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/pending', authenticate, requireAdmin, otaController.getPendingOtaUpdates);

/**
 * @swagger
 * /api/ota/sensor/{sensorId}:
 *   get:
 *     summary: Lấy OTA updates theo sensor
 *     tags: [OTA Updates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sensorId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của sensor
 *         example: S01
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
 *                       id:
 *                         type: integer
 *                       sensor_id:
 *                         type: string
 *                       firmware_version:
 *                         type: string
 *                       firmware_url:
 *                         type: string
 *                       update_status:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 */
router.get('/sensor/:sensorId', authenticate, otaController.getOtaUpdatesBySensor);

/**
 * @swagger
 * /api/ota/{otaId}:
 *   get:
 *     summary: Lấy OTA update theo ID
 *     tags: [OTA Updates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: otaId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của OTA update
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
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     sensor_id:
 *                       type: string
 *                     firmware_version:
 *                       type: string
 *                     firmware_url:
 *                       type: string
 *                     update_status:
 *                       type: string
 *                     scheduled_at:
 *                       type: string
 *                       format: date-time
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *                     completed_at:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: OTA update không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:otaId', authenticate, otaController.getOtaUpdateById);

/**
 * @swagger
 * /api/ota/{otaId}/status:
 *   put:
 *     summary: Cập nhật trạng thái OTA (Sensor gọi về)
 *     tags: [OTA Updates]
 *     description: Endpoint này không cần authentication vì sensor sẽ gọi về
 *     parameters:
 *       - in: path
 *         name: otaId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của OTA update
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [in_progress, completed, failed]
 *                 example: completed
 *               error_message:
 *                 type: string
 *                 description: Thông báo lỗi (nếu status = failed)
 *     responses:
 *       200:
 *         description: Cập nhật thành công
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
 *                   example: Cập nhật trạng thái OTA thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     update_status:
 *                       type: string
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *                     completed_at:
 *                       type: string
 *                       format: date-time
 *                     error_message:
 *                       type: string
 *       400:
 *         description: Status không hợp lệ hoặc thiếu thông tin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: OTA update không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:otaId/status', otaController.updateOtaStatus); // Không cần auth (sensor gọi về)

module.exports = router;

