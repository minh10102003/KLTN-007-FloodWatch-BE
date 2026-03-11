const userModel = require('../models/userModel');
const accessLogRepository = require('../repositories/accessLogRepository');
const crowdReportRepository = require('../repositories/crowdReportRepository');

/**
 * Lấy danh sách user đang online (is_online = true trong DB)
 */
async function getOnlineUsers(req, res) {
    try {
        const users = await userModel.getOnlineUsers();
        return res.json({
            success: true,
            data: {
                online_users: users,
                count: users.length
            }
        });
    } catch (err) {
        console.error('getOnlineUsers error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Lỗi khi lấy danh sách user online'
        });
    }
}

/**
 * Chỉ trả về số lượng user đang online (dùng cho admin, user, khách – không cần đăng nhập)
 */
async function getOnlineUsersCount(req, res) {
    try {
        const users = await userModel.getOnlineUsers();
        return res.json({
            success: true,
            data: { count: users.length }
        });
    } catch (err) {
        console.error('getOnlineUsersCount error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Lỗi khi lấy số user online'
        });
    }
}

/**
 * Thống kê báo cáo theo giờ/ngày (Moderator/Admin) – cho biểu đồ điểm đen ngập Bình Thạnh
 * Query: groupBy=hour|day, from=ISO, to=ISO (optional, mặc định 7 ngày gần nhất)
 */
async function getReportStats(req, res) {
    try {
        const groupBy = (req.query.groupBy || 'day') === 'hour' ? 'hour' : 'day';
        const from = req.query.from || null;
        const to = req.query.to || null;
        const data = await crowdReportRepository.getReportStatsByPeriod(groupBy, from, to);
        return res.json({
            success: true,
            data: {
                groupBy,
                from: from || undefined,
                to: to || undefined,
                series: data
            }
        });
    } catch (err) {
        console.error('getReportStats error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Lỗi khi lấy thống kê báo cáo'
        });
    }
}

/**
 * Lượt truy cập trong tháng (từ access_logs, middleware ghi mỗi request /api)
 */
async function getMonthlyVisits(req, res) {
    try {
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
        if (month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                error: 'Tháng phải từ 1 đến 12'
            });
        }
        const count = await accessLogRepository.getMonthlyCount(year, month);
        return res.json({
            success: true,
            data: {
                year,
                month,
                count
            }
        });
    } catch (err) {
        console.error('getMonthlyVisits error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Lỗi khi lấy lượt truy cập'
        });
    }
}

module.exports = {
    getOnlineUsers,
    getOnlineUsersCount,
    getMonthlyVisits,
    getReportStats
};
