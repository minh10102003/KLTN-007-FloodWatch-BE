const express = require('express');
const router = express.Router();
const energyController = require('../controllers/energyController');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/energy:
 *   post:
 *     summary: Tạo energy log (Sensor gọi về)
 *     tags: [Energy Monitoring]
 *     description: Endpoint này không cần authentication vì sensor sẽ gọi về
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sensor_id
 *             properties:
 *               sensor_id:
 *                 type: string
 *                 example: S01
 *               voltage:
 *                 type: number
 *                 format: float
 *                 example: 3.7
 *                 description: Điện áp (V)
 *               current:
 *                 type: number
 *                 format: float
 *                 example: 50
 *                 description: Dòng điện (mA)
 *               power:
 *                 type: number
 *                 format: float
 *                 example: 185
 *                 description: Công suất (mW)
 *               battery_level:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 85
 *                 description: Mức pin (%)
 *               power_source:
 *                 type: string
 *                 enum: [battery, solar, grid]
 *                 example: battery
 *                 default: grid
 *     responses:
 *       201:
 *         description: Lưu energy log thành công
 *       400:
 *         description: Thiếu thông tin sensor_id
 */
router.post('/', energyController.createEnergyLog); // Không cần auth (sensor gọi về)

/**
 * @swagger
 * /api/energy/sensor/{sensorId}:
 *   get:
 *     summary: Lấy energy logs theo sensor
 *     tags: [Energy Monitoring]
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
 *                       voltage:
 *                         type: number
 *                       current:
 *                         type: number
 *                       power:
 *                         type: number
 *                       battery_level:
 *                         type: integer
 *                       power_source:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 */
router.get('/sensor/:sensorId', authenticate, energyController.getEnergyLogsBySensor);

/**
 * @swagger
 * /api/energy/sensor/{sensorId}/latest:
 *   get:
 *     summary: Lấy energy log mới nhất của sensor
 *     tags: [Energy Monitoring]
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
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     sensor_id:
 *                       type: string
 *                     voltage:
 *                       type: number
 *                     current:
 *                       type: number
 *                     power:
 *                       type: number
 *                     battery_level:
 *                       type: integer
 *                     power_source:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Không tìm thấy energy log
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/sensor/:sensorId/latest', authenticate, energyController.getLatestEnergyLog);

/**
 * @swagger
 * /api/energy/sensor/{sensorId}/stats:
 *   get:
 *     summary: Lấy thống kê năng lượng của sensor
 *     tags: [Energy Monitoring]
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
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *           minimum: 1
 *           maximum: 720
 *         description: Số giờ gần đây để thống kê
 *         example: 24
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
 *                     avg_voltage:
 *                       type: number
 *                     avg_current:
 *                       type: number
 *                     avg_power:
 *                       type: number
 *                     min_battery:
 *                       type: integer
 *                     max_battery:
 *                       type: integer
 *                     avg_battery:
 *                       type: number
 *                     total_logs:
 *                       type: integer
 */
router.get('/sensor/:sensorId/stats', authenticate, energyController.getEnergyStats);

/**
 * @swagger
 * /api/energy/low-battery:
 *   get:
 *     summary: Lấy sensors có mức pin thấp (Admin only)
 *     tags: [Energy Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 0
 *           maximum: 100
 *         description: Ngưỡng mức pin (%)
 *         example: 20
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
 *                       sensor_id:
 *                         type: string
 *                       location_name:
 *                         type: string
 *                       battery_level:
 *                         type: integer
 *                       power_source:
 *                         type: string
 *                       voltage:
 *                         type: number
 *                       current:
 *                         type: number
 *                       power:
 *                         type: number
 *       403:
 *         description: Chỉ admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/low-battery', authenticate, requireAdmin, energyController.getLowBatterySensors);

module.exports = router;

