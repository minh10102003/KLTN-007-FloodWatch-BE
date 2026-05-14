const express = require('express');
const rateLimit = require('express-rate-limit');
const newsController = require('../controllers/newsController');

const router = express.Router();

const newsLimiter = rateLimit({
    windowMs: 60_000,
    max: Math.max(20, parseInt(process.env.NEWS_API_MAX_PER_MINUTE, 10) || 120),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Quá nhiều yêu cầu tin tức. Vui lòng thử lại sau.', data: [] },
});

/**
 * @swagger
 * /api/news:
 *   get:
 *     summary: Tin RSS thời sự liên quan ngập nước / thời tiết TP.HCM (public)
 *     tags: [News]
 *     description: |
 *       Gộp VnExpress, Tuổi Trẻ, Người Lao Động (thời sự), lọc keyword, tối đa 15 bài.
 *       Client gọi trực tiếp (CORS theo cấu hình backend).
 *     responses:
 *       200:
 *         description: Danh sách tin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title: { type: string }
 *                       link: { type: string }
 *                       pubDate: { type: string }
 *                       source: { type: string, example: VnExpress }
 */
router.get('/', newsLimiter, newsController.getNews);

module.exports = router;
