const express = require('express');
const router = express.Router();
const routingController = require('../controllers/routingController');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/routing/safe-path:
 *   get:
 *     summary: AMC-A* tìm đường ưu tiên an toàn ngập theo loại xe (MVP)
 *     tags: [Routing]
 *     parameters:
 *       - in: query
 *         name: start_lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: start_lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: end_lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: end_lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: vehicle_type
 *         schema: { type: string, enum: [motorbike, car, suv], default: motorbike }
 *       - in: query
 *         name: nearest_node_max_m
 *         schema: { type: integer, minimum: 150, maximum: 5000, default: 1200 }
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: Thiếu tham số hoặc đồ thị đường chưa đủ dữ liệu
 */
router.get('/v1/routing/safe-path', routingController.getSafePath);

/**
 * @swagger
 * /api/v1/admin/routing/manual-flood-depths/batch:
 *   put:
 *     summary: Admin cập nhật batch manual_flood_depth_cm cho road_edges (phục vụ mô phỏng nhanh)
 *     tags: [Routing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [updates]
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [edge_id]
 *                   properties:
 *                     edge_id: { type: integer, example: 101 }
 *                     manual_flood_depth_cm:
 *                       type: number
 *                       nullable: true
 *                       description: null để bỏ ghi đè thủ công và quay về đọc từ sensor/flood_logs
 *     responses:
 *       200:
 *         description: Thành công
 *       403:
 *         description: Chỉ admin
 */
router.put(
    '/v1/admin/routing/manual-flood-depths/batch',
    authenticate,
    requireAdmin,
    routingController.updateManualFloodDepthBatch
);

module.exports = router;
