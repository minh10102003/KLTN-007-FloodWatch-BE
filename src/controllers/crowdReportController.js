const crowdReportModel = require('../models/crowdReportModel');
const userModel = require('../models/userModel');
const { withFullPhotoUrls } = require('../utils/photoUrl');

const crowdReportController = {
    // Lấy các báo cáo từ người dân trong vòng 24 giờ qua (photo_url trả full URL)
    getCrowdReports: async (req, res) => {
        try {
            const { hours, moderation_status, validation_status } = req.query;
            const data = await crowdReportModel.getRecentReports(
                parseInt(hours) || 24,
                moderation_status,
                validation_status
            );
            res.json({ success: true, data: withFullPhotoUrls(req, data) });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy tất cả báo cáo của user hiện tại (yêu cầu authentication, photo_url full URL)
    getAllReports: async (req, res) => {
        try {
            const { limit, moderation_status } = req.query;
            const userId = req.user.id; // Lấy từ token (đã được authenticate middleware xác thực)
            
            // Lấy tất cả reports của user này (kể cả pending, approved, rejected)
            const data = await crowdReportModel.getUserReports(userId, limit || 1000, moderation_status);
            
            res.json({ 
                success: true, 
                data: withFullPhotoUrls(req, data) 
            });
        } catch (err) {
            res.status(500).json({ 
                success: false, 
                error: err.message 
            });
        }
    },

    // Nhận báo cáo ngập lụt từ người dùng với xác minh chéo
    // User đăng nhập: dùng tên từ tài khoản (full_name), không bắt buộc gửi name trong body.
    // Khách (không đăng nhập): bắt buộc gửi name trong body.
    createReport: async (req, res) => {
        try {
            const { name, level, lng, lat, photo_url, location_description } = req.body;
            
            // Validate: level, lng, lat luôn bắt buộc
            if (!level || lng == null || lat == null) {
                return res.status(400).json({ 
                    success: false, 
                    error: "Thiếu thông tin bắt buộc: level, lng, lat" 
                });
            }
            // Khách (không đăng nhập) bắt buộc gửi name
            if (!req.user && !name) {
                return res.status(400).json({ 
                    success: false, 
                    error: "Khách báo cáo cần nhập tên (name). Nếu đã có tài khoản, hãy đăng nhập để báo cáo không cần nhập tên." 
                });
            }
            
            // Validate flood_level
            const validLevels = ['Nhẹ', 'Trung bình', 'Nặng'];
            if (!validLevels.includes(level)) {
                return res.status(400).json({ 
                    success: false, 
                    error: "Mức độ ngập không hợp lệ. Chọn: Nhẹ, Trung bình, hoặc Nặng" 
                });
            }
            
            // Lấy reporter_id từ token nếu user đã đăng nhập
            const reporter_id = req.user ? String(req.user.id) : null;
            
            // Tên hiển thị: user đăng nhập lấy từ tài khoản (full_name hoặc username), khách lấy từ body
            let reporter_name = name || '';
            if (req.user) {
                const user = await userModel.getUserById(req.user.id);
                reporter_name = (user?.full_name && user.full_name.trim()) ? user.full_name.trim() : (user?.username || 'User');
            }
            
            const result = await crowdReportModel.createReport(
                reporter_name, 
                reporter_id, 
                level, 
                lng, 
                lat, 
                photo_url,
                location_description
            );
            
            let message = "Cảm ơn bạn đã báo cáo!";
            if (result.verified_by_sensor) {
                message = "Báo cáo của bạn đã được xác minh bởi hệ thống cảm biến. Cảm ơn!";
            } else if (result.validation_status === 'pending') {
                message = "Báo cáo của bạn đang được xem xét. Cảm ơn!";
            }
            
            res.json({ 
                success: true, 
                message: message,
                data: {
                    id: result.id,
                    validation_status: result.validation_status,
                    verified_by_sensor: result.verified_by_sensor,
                    reporter_id: reporter_id
                }
            });
        } catch (err) {
            // Đặc tả: Ngoài vùng phủ sensor → 400 với message chuẩn
            if (err.code === 'NO_SENSOR_IN_RADIUS') {
                return res.status(400).json({
                    success: false,
                    error: 'Hiện tại khu vực chưa có máy đo, không thể xác thực'
                });
            }
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = crowdReportController;






