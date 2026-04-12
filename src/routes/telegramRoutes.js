const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegramController');

/**
 * @swagger
 * /api/v1/telegram/webhook:
 *   post:
 *     summary: Webhook nhận Update từ Telegram Bot (liên kết chat riêng /start token)
 *     tags: [Telegram]
 *     description: |
 *       Đặt URL này qua `setWebhook` của Bot API. Bảo vệ bằng `TELEGRAM_WEBHOOK_SECRET` (header `X-Telegram-Bot-Api-Secret-Token`).
 *       Không dùng Bearer JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Luôn 200 nếu parse được (tránh Telegram retry)
 *       403:
 *         description: Sai secret
 */
router.post('/v1/telegram/webhook', telegramController.webhook);

module.exports = router;
