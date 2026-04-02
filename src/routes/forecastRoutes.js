const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecastController');

/**
 * @swagger
 * /api/v1/forecast/sensor/{sensorId}:
 *   get:
 *     summary: Dự báo mực nước ngắn hạn theo sensor (xu hướng tuyến tính)
 *     tags: [Forecast]
 *     description: |
 *       Dùng chuỗi `flood_logs` trong cửa sổ `sample_minutes` để ước lượng vận tốc (cm/giờ) và mực nước dự kiến sau `horizon` phút.
 *       Trả về so sánh với ngưỡng warning/danger và ước lượng phút tới ngưỡng (khi xu hướng tăng).
 *     parameters:
 *       - in: path
 *         name: sensorId
 *         required: true
 *         schema: { type: string }
 *         example: S01
 *       - in: query
 *         name: horizon
 *         schema: { type: integer, default: 60, minimum: 15, maximum: 120 }
 *         description: Số phút lookahead
 *       - in: query
 *         name: sample_minutes
 *         schema: { type: integer, default: 90, minimum: 15, maximum: 1440 }
 *         description: Độ dài cửa sổ lịch sử (phút) để fit xu hướng
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: Sensor không active
 *       404:
 *         description: Không tìm thấy sensor
 */
router.get('/v1/forecast/sensor/:sensorId', forecastController.getSensorForecast);

module.exports = router;
