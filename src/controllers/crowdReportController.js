const crowdReportModel = require('../models/crowdReportModel');

const crowdReportController = {
    // Lấy các báo cáo từ người dân trong vòng 24 giờ qua
    getCrowdReports: async (req, res) => {
        try {
            const data = await crowdReportModel.getRecentReports();
            res.json({ success: true, data: data });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy tất cả báo cáo (không giới hạn thời gian)
    getAllReports: async (req, res) => {
        try {
            const { limit } = req.query;
            const data = await crowdReportModel.getAllReports(limit || 100);
            res.json({ success: true, data: data });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Nhận báo cáo ngập lụt từ người dùng với xác minh chéo
    createReport: async (req, res) => {
        try {
            const { name, reporter_id, level, lng, lat, photo_url } = req.body;
            
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
            
            const result = await crowdReportModel.createReport(name, reporter_id, level, lng, lat, photo_url);
            
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
                    validation_status: result.validation_status,
                    verified_by_sensor: result.verified_by_sensor
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = crowdReportController;






