const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// GET /api/sensors - Lấy tất cả sensors
router.get('/sensors', sensorController.getAllSensors);

// GET /api/sensors/:sensorId - Lấy thông tin một sensor
router.get('/sensors/:sensorId', sensorController.getSensorById);

// POST /api/sensors - Tạo sensor mới
router.post('/sensors', sensorController.createSensor);

// PUT /api/sensors/:sensorId - Cập nhật sensor
router.put('/sensors/:sensorId', sensorController.updateSensor);

// PUT /api/sensors/:sensorId/thresholds - Cập nhật ngưỡng báo động
router.put('/sensors/:sensorId/thresholds', sensorController.updateThresholds);

// DELETE /api/sensors/:sensorId - Xóa sensor
router.delete('/sensors/:sensorId', sensorController.deleteSensor);

module.exports = router;
