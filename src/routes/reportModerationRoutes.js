const express = require('express');
const router = express.Router();
const reportModerationController = require('../controllers/reportModerationController');
const { authenticate, requireModerator } = require('../middleware/auth');

/**
 * @swagger
 * /api/reports/pending:
 *   get:
 *     summary: Lấy báo cáo cần kiểm duyệt (Moderator/Admin only)
 *     tags: [Report Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 200
 *         description: Số lượng báo cáo tối đa
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
 *                     $ref: '#/components/schemas/CrowdReport'
 *       403:
 *         description: Chỉ moderator hoặc admin mới có quyền
 */
router.get('/pending', authenticate, requireModerator, reportModerationController.getPendingReports);

/**
 * @swagger
 * /api/reports/{reportId}/moderate:
 *   put:
 *     summary: Kiểm duyệt báo cáo (approve/reject) - Moderator/Admin only
 *     tags: [Report Moderation]
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
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 example: approve
 *                 description: Hành động kiểm duyệt
 *               rejection_reason:
 *                 type: string
 *                 example: Báo cáo không chính xác
 *                 description: Lý do từ chối (nếu action = reject)
 *     responses:
 *       200:
 *         description: Kiểm duyệt thành công
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
 *                   example: Đã duyệt báo cáo
 *                 data:
 *                   $ref: '#/components/schemas/CrowdReport'
 *       400:
 *         description: Action phải là "approve" hoặc "reject"
 *       403:
 *         description: Chỉ moderator hoặc admin mới có quyền
 */
router.put('/:reportId/moderate', authenticate, requireModerator, reportModerationController.moderateReport);

/**
 * @swagger
 * /api/reports/reliability-ranking:
 *   get:
 *     summary: Lấy xếp hạng tin cậy của users
 *     tags: [Report Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           minimum: 1
 *           maximum: 500
 *         description: Số lượng user tối đa
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
 *                       reporter_id:
 *                         type: string
 *                       reporter_name:
 *                         type: string
 *                       total_reports:
 *                         type: integer
 *                       avg_reliability:
 *                         type: number
 *                         format: float
 *                       verified_count:
 *                         type: integer
 *                       approved_count:
 *                         type: integer
 */
router.get('/reliability-ranking', authenticate, reportModerationController.getReliabilityRanking);

module.exports = router;

