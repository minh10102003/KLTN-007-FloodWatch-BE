const rateLimit = require('express-rate-limit');

/** ~15 req/phút (free tier Gemini) — cấu hình qua CHAT_API_MAX_PER_MINUTE */
const chatLimiter = rateLimit({
    windowMs: 60_000,
    max: Math.max(5, parseInt(process.env.CHAT_API_MAX_PER_MINUTE, 10) || 12),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Quá nhiều tin nhắn chat. Vui lòng thử lại sau một phút.',
        reply: null
    }
});

module.exports = { chatLimiter };
