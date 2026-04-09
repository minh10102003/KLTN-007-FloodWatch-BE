const express = require('express');
const router = express.Router();
const researchController = require('../controllers/researchController');

/**
 * @swagger
 * /api/v1/research/evaluation:
 *   get:
 *     summary: D1 - Đánh giá định lượng MAE/RMSE (crowd-only vs fused, tham chiếu sensor gần nhất)
 *     tags: [Research]
 *     parameters:
 *       - in: query
 *         name: crowd_hours
 *         schema: { type: integer, default: 72, minimum: 1, maximum: 168 }
 *       - in: query
 *         name: sensor_hours
 *         schema: { type: integer, default: 6, minimum: 1, maximum: 72 }
 *       - in: query
 *         name: min_lng
 *         schema: { type: number }
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
 *       400:
 *         description: Tham số bbox không hợp lệ
 */
router.get('/v1/research/evaluation', researchController.evaluateFusion);

/**
 * @swagger
 * /api/v1/research/cold-start-hotspots:
 *   get:
 *     summary: D2 - Điểm nóng crowd ở vùng thiếu cảm biến
 *     tags: [Research]
 *     parameters:
 *       - in: query
 *         name: report_hours
 *         schema: { type: integer, default: 72, minimum: 1, maximum: 336 }
 *       - in: query
 *         name: no_sensor_radius_m
 *         schema: { type: integer, default: 1500, minimum: 100, maximum: 10000 }
 *       - in: query
 *         name: min_reports
 *         schema: { type: integer, default: 2, minimum: 1, maximum: 50 }
 *       - in: query
 *         name: min_lng
 *         schema: { type: number }
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
 *       400:
 *         description: Tham số bbox không hợp lệ
 */
router.get('/v1/research/cold-start-hotspots', researchController.getColdStartHotspots);

module.exports = router;
