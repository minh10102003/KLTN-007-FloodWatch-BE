const rateLimit = require('express-rate-limit');

/**
 * Giới hạn POST báo cáo crowd công khai (B3). IP lấy từ req.ip (cần trust proxy trên Render).
 */
const reportFloodLimiter = rateLimit({
    windowMs: Math.max(60_000, (parseInt(process.env.REPORT_FLOOD_WINDOW_MS, 10) || 900_000)), // mặc định 15 phút
    max: Math.max(1, parseInt(process.env.REPORT_FLOOD_MAX_PER_WINDOW, 10) || 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Quá nhiều báo cáo trong khoảng thời gian ngắn. Vui lòng thử lại sau.'
    }
});

module.exports = { reportFloodLimiter };
