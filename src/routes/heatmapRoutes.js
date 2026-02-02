const express = require('express');
const router = express.Router();
const heatmapController = require('../controllers/heatmapController');

/**
 * @swagger
 * /api/heatmap:
 *   get:
 *     summary: Lấy dữ liệu heatmap từ sensors
 *     tags: [Heatmap]
 *     parameters:
 *       - in: query
 *         name: minLng
 *         schema:
 *           type: number
 *           format: float
 *         description: Longitude tối thiểu
 *         example: 106.7
 *       - in: query
 *         name: minLat
 *         schema:
 *           type: number
 *           format: float
 *         description: Latitude tối thiểu
 *         example: 10.7
 *       - in: query
 *         name: maxLng
 *         schema:
 *           type: number
 *           format: float
 *         description: Longitude tối đa
 *         example: 106.8
 *       - in: query
 *         name: maxLat
 *         schema:
 *           type: number
 *           format: float
 *         description: Latitude tối đa
 *         example: 10.8
 *       - in: query
 *         name: gridSize
 *         schema:
 *           type: integer
 *           default: 500
 *         description: Kích thước lưới (mét)
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
 *                       lng:
 *                         type: number
 *                       lat:
 *                         type: number
 *                       intensity:
 *                         type: number
 *                       max_intensity:
 *                         type: number
 *                       data_count:
 *                         type: integer
 *                       max_status:
 *                         type: string
 */
router.get('/', heatmapController.getHeatmapData);

/**
 * @swagger
 * /api/heatmap/combined:
 *   get:
 *     summary: Lấy dữ liệu heatmap kết hợp (sensors + crowd reports)
 *     tags: [Heatmap]
 *     parameters:
 *       - in: query
 *         name: minLng
 *         schema:
 *           type: number
 *           format: float
 *         description: Longitude tối thiểu
 *         example: 106.7
 *       - in: query
 *         name: minLat
 *         schema:
 *           type: number
 *           format: float
 *         description: Latitude tối thiểu
 *         example: 10.7
 *       - in: query
 *         name: maxLng
 *         schema:
 *           type: number
 *           format: float
 *         description: Longitude tối đa
 *         example: 106.8
 *       - in: query
 *         name: maxLat
 *         schema:
 *           type: number
 *           format: float
 *         description: Latitude tối đa
 *         example: 10.8
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
 *                       lng:
 *                         type: number
 *                       lat:
 *                         type: number
 *                       water_level:
 *                         type: number
 *                       status:
 *                         type: string
 *                       source:
 *                         type: string
 *                         enum: [sensor, crowd]
 */
router.get('/combined', heatmapController.getCombinedHeatmapData);

module.exports = router;

