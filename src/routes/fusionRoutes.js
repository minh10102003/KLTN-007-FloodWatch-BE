const express = require('express');
const router = express.Router();
const fusionController = require('../controllers/fusionController');

/**
 * @swagger
 * /api/v1/fusion/points:
 *   get:
 *     summary: Điểm fusion cảm biến + crowd (so sánh crowd_only vs fused)
 *     tags: [Sensor–Crowd Fusion]
 *     description: |
 *       Trả về hai nhóm điểm:
 *       - **sensors**: mỗi cảm biến có `water_level_sensor_only_cm` và `water_level_fused_cm` (tại vị trí cảm biến hai giá trị trùng nhau).
 *       - **crowd**: mỗi báo cáo đã duyệt có `crowd_only_cm` (từ mức Nhẹ/Trung bình/Nặng) và `fused_cm` (trộn với cảm biến gần nhất nếu trong bán kính hiệu lực).
 *       Trọng số cảm biến giảm theo khoảng cách; trọng số crowd giảm khi lệch nhiều so với cảm biến gần nhất.
 *       Tham số mô hình tùy chỉnh qua `FUSION_R_MAX_M`, `FUSION_DECAY_DIST_M`, `FUSION_DISAGREE_SCALE_CM` trong `.env`.
 *     parameters:
 *       - in: query
 *         name: crowd_hours
 *         schema: { type: integer, default: 24, minimum: 1, maximum: 168 }
 *         description: Cửa sổ thời gian báo cáo crowd (giờ)
 *       - in: query
 *         name: sensor_hours
 *         schema: { type: integer, default: 1, minimum: 1, maximum: 72 }
 *         description: Cửa sổ lấy bản ghi flood_logs mới nhất mỗi cảm biến (giờ)
 *       - in: query
 *         name: include_sensors
 *         schema: { type: string, enum: ['true', 'false'], default: 'true' }
 *         description: Có trả danh sách điểm cảm biến hay không
 *       - in: query
 *         name: min_lng
 *         schema: { type: number }
 *         description: Bắt buộc cùng max_lng, min_lat, max_lat nếu muốn lọc bbox
 *       - in: query
 *         name: max_lng
 *         schema: { type: number }
 *       - in: query
 *         name: min_lat
 *         schema: { type: number }
 *       - in: query
 *         name: max_lat
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     crowd_report_hours: { type: integer }
 *                     sensor_log_hours: { type: integer }
 *                     fusion_params:
 *                       type: object
 *                       properties:
 *                         rMaxM: { type: number }
 *                         decayDistM: { type: number }
 *                         disagreeScaleCm: { type: number }
 *                 data:
 *                   type: object
 *                   properties:
 *                     sensors: { type: array, items: { type: object } }
 *                     crowd: { type: array, items: { type: object } }
 *       400:
 *         description: Tham số bbox không hợp lệ
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/v1/fusion/points', fusionController.getFusionPoints);

module.exports = router;
