const accessLogRepository = require('../repositories/accessLogRepository');

/**
 * Middleware ghi mỗi request vào access_logs (không chặn response).
 * Chỉ nên dùng cho route /api để đếm "lượt truy cập hàng tháng".
 */
function accessLogMiddleware(req, res, next) {
    const path = req.path || '';
    accessLogRepository.log(path).catch((err) => {
        console.error('❌ [AccessLog]', err.message);
    });
    next();
}

module.exports = accessLogMiddleware;
