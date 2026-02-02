const express = require('express');
const router = express.Router();
const reportEvaluationController = require('../controllers/reportEvaluationController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/report-evaluations/{reportId}:
 *   post:
 *     summary: Tạo đánh giá cho báo cáo
 *     tags: [Report Evaluation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của báo cáo
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *                 description: Điểm đánh giá từ 1-5 sao
 *               comment:
 *                 type: string
 *                 example: Báo cáo rất chính xác
 *     responses:
 *       201:
 *         description: Đánh giá thành công
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
 *                   example: Đánh giá thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     report_id:
 *                       type: integer
 *                     evaluator_id:
 *                       type: integer
 *                     rating:
 *                       type: integer
 *                     comment:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Rating phải từ 1 đến 5 hoặc thiếu thông tin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:reportId', authenticate, reportEvaluationController.createEvaluation);

/**
 * @swagger
 * /api/report-evaluations/{reportId}:
 *   get:
 *     summary: Lấy tất cả đánh giá của một báo cáo
 *     tags: [Report Evaluation]
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của báo cáo
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       report_id:
 *                         type: integer
 *                       rating:
 *                         type: integer
 *                       comment:
 *                         type: string
 *                       evaluator_username:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 */
router.get('/:reportId', reportEvaluationController.getEvaluationsByReport);

/**
 * @swagger
 * /api/report-evaluations/{reportId}/average:
 *   get:
 *     summary: Lấy điểm trung bình của báo cáo
 *     tags: [Report Evaluation]
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của báo cáo
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
 *                     avg_rating:
 *                       type: number
 *                       format: float
 *                       example: 4.5
 *                       description: Điểm trung bình (1-5)
 *                     total_evaluations:
 *                       type: integer
 *                       example: 10
 *                       description: Tổng số đánh giá
 *       404:
 *         description: Báo cáo không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:reportId/average', reportEvaluationController.getAverageRating);

module.exports = router;

