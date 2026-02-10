const crowdReportModel = require('../models/crowdReportModel');

const crowdReportController = {
    // Lấy các báo cáo từ người dân trong vòng 24 giờ qua
    getCrowdReports: async (req, res) => {
        try {
            const { hours, moderation_status, validation_status } = req.query;
            const data = await crowdReportModel.getRecentReports(
                parseInt(hours) || 24,
                moderation_status,
                validation_status
            );
            res.json({ success: true, data: data });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy tất cả báo cáo của user hiện tại (yêu cầu authentication)
    getAllReports: async (req, res) => {
        try {
            const { limit, moderation_status } = req.query;
            const userId = req.user.id; // Lấy từ token (đã được authenticate middleware xác thực)
            
            // Lấy tất cả reports của user này (kể cả pending, approved, rejected)
            const data = await crowdReportModel.getUserReports(userId, limit || 1000, moderation_status);
            
            res.json({ 
                success: true, 
                data: data 
            });
        } catch (err) {
            res.status(500).json({ 
                success: false, 
                error: err.message 
            });
        }
    },

    // Nhận báo cáo ngập lụt từ người dùng với xác minh chéo
    createReport: async (req, res) => {
        try {
            const { name, level, lng, lat, photo_url, location_description } = req.body;
            
            // Validate input
            if (!name || !level || !lng || !lat) {
                return res.status(400).json({ 
                    success: false, 
                    error: "Thiếu thông tin bắt buộc: name, level, lng, lat" 
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
            
            // Lấy reporter_id từ token nếu user đã đăng nhập (optional)
            // Nếu không có token, reporter_id sẽ là null (cho phép báo cáo ẩn danh)
            // Convert sang string vì database lưu VARCHAR
            const reporter_id = req.user ? String(req.user.id) : null;
            
            const result = await crowdReportModel.createReport(
                name, 
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
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = crowdReportController;






