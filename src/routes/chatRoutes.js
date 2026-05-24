const express = require('express');
const chatController = require('../controllers/chatController');
const { chatLimiter } = require('../middleware/chatRateLimit');
const { reportFloodLimiter } = require('../middleware/reportRateLimit');
const { optionalAuthenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Chatbot cảnh báo ngập (Gemini + dữ liệu sensor thật)
 *     tags: [Chat]
 *     description: |
 *       Public (không bắt buộc JWT). Rate limit theo IP.
 *       Body `history`: mảng `{ role: "user"|"model", content: string }` (tối đa ~20 lượt).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *               history:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, model] }
 *                     content: { type: string }
 *               account_id: { type: string, description: "ID ẩn danh từ FE (localStorage), không lưu server" }
 *               area: { type: string, description: "Lọc snapshot sensor theo tên khu vực" }
 *     responses:
 *       200:
 *         description: Phản hồi AI
 *       429:
 *         description: Rate limit
 *       503:
 *         description: Chưa cấu hình GEMINI_API_KEY
 */
router.post('/chat', chatLimiter, chatController.postChat);

/**
 * @swagger
 * /api/chat/confirm-report:
 *   post:
 *     summary: Xác nhận gửi báo cáo ngập từ bản nháp chat (Hướng B)
 *     tags: [Chat]
 *     description: |
 *       Sau khi POST /api/chat trả meta.report_draft.ready=true, FE gửi body xác nhận.
 *       Cùng quy tắc POST /api/report-flood (level, lat, lng; JWT hoặc name khách).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [level, lat, lng]
 *             properties:
 *               level: { type: string, enum: [Mức 1, Mức 2, Mức 3, Mức 4, Mức 5] }
 *               lat: { type: number }
 *               lng: { type: number }
 *               location_description: { type: string }
 *               content: { type: string }
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: Báo cáo đã tạo
 */
router.post(
    '/chat/confirm-report',
    reportFloodLimiter,
    optionalAuthenticate,
    chatController.confirmReport
);

/**
 * @swagger
 * /api/flood-status:
 *   get:
 *     summary: Trạng thái ngập theo sensor (cho chat / widget)
 *     tags: [Chat]
 *     parameters:
 *       - in: query
 *         name: area
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Danh sách sensor định dạng chat
 */
router.get('/flood-status', chatController.getFloodStatus);

module.exports = router;
