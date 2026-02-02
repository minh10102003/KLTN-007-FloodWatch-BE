const express = require('express');
const router = express.Router();
const floodController = require('../controllers/floodController');

/**
 * @swagger
 * /api/v1/flood-data/realtime:
 *   get:
 *     summary: Lấy dữ liệu ngập lụt real-time (KHUYẾN NGHỊ)
 *     tags: [Flood Data]
 *     description: Trả về dữ liệu mới nhất của tất cả sensors với đầy đủ trạng thái
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [normal, warning, danger, offline]
 *         description: Lọc theo trạng thái
 *         example: warning
 *       - in: query
 *         name: sensor_id
 *         schema:
 *           type: string
 *         description: Lọc theo sensor ID
 *         example: S01
 *       - in: query
 *         name: min_water_level
 *         schema:
 *           type: number
 *           format: float
 *         description: Mực nước tối thiểu (cm)
 *         example: 10
 *       - in: query
 *         name: max_water_level
 *         schema:
 *           type: number
 *           format: float
 *         description: Mực nước tối đa (cm)
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
 *                     $ref: '#/components/schemas/FloodData'
 */
router.get('/v1/flood-data/realtime', floodController.getRealTimeFloodData);

/**
 * @swagger
 * /api/v1/flood-data:
 *   get:
 *     summary: Lấy dữ liệu ngập lụt kèm thông tin sensor
 *     tags: [Flood Data]
 *     description: API này trả về bản ghi mới nhất cho mỗi sensor
 *     parameters:
 *       - in: query
 *         name: sensor_id
 *         schema:
 *           type: string
 *         description: Lọc theo sensor ID
 *         example: S01
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Chỉ lấy sensors đang active
 *         example: true
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
 *                     $ref: '#/components/schemas/FloodData'
 */
router.get('/v1/flood-data', floodController.getFloodData);

/**
 * @swagger
 * /api/flood-history:
 *   get:
 *     summary: Lấy lịch sử ngập lụt (API cũ - giữ để tương thích)
 *     tags: [Flood Data]
 *     description: API này trả về tất cả flood logs, không join với sensors
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           minimum: 1
 *           maximum: 1000
 *         description: Số lượng bản ghi tối đa
 *         example: 100
 *       - in: query
 *         name: sensor_id
 *         schema:
 *           type: string
 *         description: Lọc theo sensor ID
 *         example: S01
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [normal, warning, danger, offline]
 *         description: Lọc theo trạng thái
 *         example: warning
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày bắt đầu (ISO 8601)
 *         example: 2024-12-20T00:00:00Z
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày kết thúc (ISO 8601)
 *         example: 2024-12-21T23:59:59Z
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
 *                       raw_distance:
 *                         type: number
 *                       water_level:
 *                         type: number
 *                       velocity:
 *                         type: number
 *                       status:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 */
router.get('/flood-history', floodController.getFloodHistory);

/**
 * @swagger
 * /api/sensors/{sensorId}/history:
 *   get:
 *     summary: Lấy lịch sử dữ liệu theo sensor
 *     tags: [Flood Data]
 *     parameters:
 *       - in: path
 *         name: sensorId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của sensor
 *         example: S01
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           minimum: 1
 *           maximum: 1000
 *         description: Số lượng bản ghi tối đa
 *         example: 100
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
 *                       raw_distance:
 *                         type: number
 *                       water_level:
 *                         type: number
 *                       velocity:
 *                         type: number
 *                       status:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 */
router.get('/sensors/:sensorId/history', floodController.getFloodHistoryBySensor);

module.exports = router;
