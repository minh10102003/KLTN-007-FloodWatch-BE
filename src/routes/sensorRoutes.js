const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

/**
 * @swagger
 * /api/sensors:
 *   get:
 *     summary: Lấy tất cả sensors
 *     tags: [Sensors]
 *     parameters:
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Lọc theo trạng thái active
 *         example: true
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [normal, warning, danger, offline]
 *         description: Lọc theo trạng thái
 *         example: normal
 *       - in: query
 *         name: hardware_type
 *         schema:
 *           type: string
 *         description: Lọc theo loại hardware
 *         example: ESP32
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
 *                     $ref: '#/components/schemas/Sensor'
 */
router.get('/', sensorController.getAllSensors);

/**
 * @swagger
 * /api/sensors/{sensorId}:
 *   get:
 *     summary: Lấy thông tin sensor theo ID
 *     tags: [Sensors]
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
 *                   $ref: '#/components/schemas/Sensor'
 *       404:
 *         description: Sensor không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:sensorId', sensorController.getSensorById);

/**
 * @swagger
 * /api/sensors:
 *   post:
 *     summary: Tạo sensor mới
 *     tags: [Sensors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sensor_id
 *               - location_name
 *               - lng
 *               - lat
 *               - installation_height
 *             properties:
 *               sensor_id:
 *                 type: string
 *                 example: S02
 *                 description: ID duy nhất của sensor
 *               location_name:
 *                 type: string
 *                 example: Ngã Tư Hàng Xanh
 *                 description: Tên địa điểm
 *               lng:
 *                 type: number
 *                 format: float
 *                 example: 106.700
 *                 description: Longitude
 *               lat:
 *                 type: number
 *                 format: float
 *                 example: 10.800
 *                 description: Latitude
 *               hardware_type:
 *                 type: string
 *                 example: ESP32
 *                 description: Loại hardware (ESP32, LoRa, Wokwi, etc.)
 *               model:
 *                 type: string
 *                 example: HC-SR04
 *                 description: Model của cảm biến
 *               installation_date:
 *                 type: string
 *                 format: date
 *                 example: 2024-12-20
 *                 description: Ngày lắp đặt
 *               installation_height:
 *                 type: number
 *                 format: float
 *                 example: 120
 *                 description: Độ cao lắp đặt (cm) - khoảng cách từ cảm biến tới đáy cống
 *               warning_threshold:
 *                 type: number
 *                 format: float
 *                 example: 10
 *                 default: 10
 *                 description: Ngưỡng cảnh báo (cm)
 *               danger_threshold:
 *                 type: number
 *                 format: float
 *                 example: 30
 *                 default: 30
 *                 description: Ngưỡng nguy hiểm (cm)
 *     responses:
 *       201:
 *         description: Tạo sensor thành công
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
 *                   example: Tạo sensor thành công
 *                 data:
 *                   $ref: '#/components/schemas/Sensor'
 *       400:
 *         description: Thiếu thông tin bắt buộc hoặc sensor_id đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', sensorController.createSensor);

/**
 * @swagger
 * /api/sensors/{sensorId}:
 *   put:
 *     summary: Cập nhật sensor
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: sensorId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của sensor
 *         example: S01
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               location_name:
 *                 type: string
 *                 example: Cầu Sài Gòn - Cập nhật
 *               lng:
 *                 type: number
 *                 format: float
 *                 example: 106.721
 *                 description: Longitude
 *               lat:
 *                 type: number
 *                 format: float
 *                 example: 10.798
 *                 description: Latitude
 *               hardware_type:
 *                 type: string
 *                 example: ESP32
 *               model:
 *                 type: string
 *                 example: HC-SR04
 *               installation_date:
 *                 type: string
 *                 format: date
 *                 example: 2024-12-20
 *               installation_height:
 *                 type: number
 *                 format: float
 *                 example: 150
 *                 description: Độ cao lắp đặt (cm)
 *               is_active:
 *                 type: boolean
 *                 example: true
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
 *                   example: Cập nhật sensor thành công
 *                 data:
 *                   $ref: '#/components/schemas/Sensor'
 *       404:
 *         description: Sensor không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:sensorId', sensorController.updateSensor);

/**
 * @swagger
 * /api/sensors/{sensorId}/thresholds:
 *   put:
 *     summary: Cập nhật ngưỡng báo động
 *     tags: [Sensors]
 *     parameters:
 *       - in: path
 *         name: sensorId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của sensor
 *         example: S01
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - warning_threshold
 *               - danger_threshold
 *             properties:
 *               warning_threshold:
 *                 type: number
 *                 format: float
 *                 example: 15
 *                 description: Ngưỡng cảnh báo (cm)
 *               danger_threshold:
 *                 type: number
 *                 format: float
 *                 example: 35
 *                 description: Ngưỡng nguy hiểm (cm)
 *               updated_by:
 *                 type: string
 *                 example: admin
 *                 description: Người cập nhật (optional)
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
 *                   example: Cập nhật ngưỡng báo động thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     sensor_id:
 *                       type: string
 *                     warning_threshold:
 *                       type: number
 *                     danger_threshold:
 *                       type: number
 *                     updated_by:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: warning_threshold phải nhỏ hơn danger_threshold hoặc thiếu thông tin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:sensorId/thresholds', sensorController.updateThresholds);

/**
 * @swagger
 * /api/sensors/{sensorId}:
 *   delete:
 *     summary: Xóa sensor
 *     tags: [Sensors]
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
 *         description: Xóa thành công
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
 *                   example: Xóa sensor thành công
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:sensorId', sensorController.deleteSensor);

module.exports = router;
