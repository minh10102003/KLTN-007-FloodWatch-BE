const crowdReportModel = require('../models/crowdReportModel');
const { submitCrowdReport } = require('../services/crowdReportSubmitService');
const { withFullPhotoUrls } = require('../utils/photoUrl');
const { withReportConfidence } = require('../utils/reportConfidence');
const { withReportDisplayStatus } = require('../utils/reportDisplayStatus');

function enrichReportRows(req, data) {
    return withFullPhotoUrls(req, withReportDisplayStatus(withReportConfidence(data)));
}

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
            res.json({ success: true, data: enrichReportRows(req, data) });
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
                data: enrichReportRows(req, data)
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
            const result = await submitCrowdReport({ user: req.user || null, body: req.body });
            res.json({
                success: true,
                message: result.message,
                data: result.data
            });
        } catch (err) {
            if (err.code === 'VALIDATION') {
                return res.status(400).json({ success: false, error: err.message });
            }
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






