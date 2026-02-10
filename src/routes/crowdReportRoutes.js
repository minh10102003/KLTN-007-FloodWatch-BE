const express = require('express');
const router = express.Router();
const crowdReportController = require('../controllers/crowdReportController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/crowd-reports:
 *   get:
 *     summary: Lấy báo cáo trong 24 giờ qua
 *     tags: [Crowd Reports]
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *           minimum: 1
 *           maximum: 168
 *         description: Số giờ gần đây (mặc định 24h)
 *         example: 24
 *       - in: query
 *         name: moderation_status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Lọc theo trạng thái kiểm duyệt
 *         example: approved
 *       - in: query
 *         name: validation_status
 *         schema:
 *           type: string
 *           enum: [pending, verified, rejected, cross_verified]
 *         description: Lọc theo trạng thái xác minh
 *         example: cross_verified
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
 */
router.get('/crowd-reports', crowdReportController.getCrowdReports);

/**
 * @swagger
 * /api/crowd-reports/all:
 *   get:
 *     summary: Lấy tất cả báo cáo của user hiện tại (yêu cầu authentication)
 *     description: |
 *       Endpoint này yêu cầu Bearer token và chỉ trả về các báo cáo của user đang đăng nhập.
 *       Bao gồm tất cả trạng thái: pending, approved, rejected.
 *     tags: [Crowd Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           minimum: 1
 *           maximum: 1000
 *         description: Số lượng báo cáo tối đa
 *         example: 100
 *       - in: query
 *         name: moderation_status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Lọc theo trạng thái kiểm duyệt
 *         example: approved
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
 */
// Endpoint này yêu cầu authentication để lấy reports của user hiện tại
router.get('/crowd-reports/all', authenticate, crowdReportController.getAllReports);

/**
 * @swagger
 * /api/report-flood:
 *   post:
 *     summary: Tạo báo cáo ngập lụt mới (với xác minh chéo)
 *     description: |
 *       Endpoint này cho phép cả authenticated và anonymous users.
 *       - Nếu có Bearer token: reporter_id sẽ được lưu từ token
 *       - Nếu không có token: reporter_id = null (báo cáo ẩn danh)
 *     tags: [Crowd Reports]
 *     security:
 *       - bearerAuth: []  # Optional - không bắt buộc
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - level
 *               - lng
 *               - lat
 *             properties:
 *               name:
 *                 type: string
 *                 example: Nguyễn Văn A
 *               reporter_id:
 *                 type: string
 *                 example: user123
 *               level:
 *                 type: string
 *                 enum: [Nhẹ, Trung bình, Nặng]
 *                 example: Nặng
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
 *               photo_url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/photo.jpg
 *     responses:
 *       200:
 *         description: Tạo báo cáo thành công
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
 *                   example: Báo cáo của bạn đã được xác minh bởi hệ thống cảm biến. Cảm ơn!
 *                 data:
 *                   type: object
 *                   properties:
 *                     validation_status:
 *                       type: string
 *                       enum: [pending, verified, cross_verified]
 *                     verified_by_sensor:
 *                       type: boolean
 *       400:
 *         description: Thiếu thông tin hoặc mức độ ngập không hợp lệ
 */
// POST /api/report-flood - Cho phép cả authenticated và anonymous users
// Nếu có token, sẽ lưu reporter_id; nếu không, reporter_id = null (báo cáo ẩn danh)
router.post('/report-flood', optionalAuthenticate, crowdReportController.createReport);

module.exports = router;






