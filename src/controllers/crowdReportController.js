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

    // Nhận báo cáo ngập lụt từ người dùng
    createReport: async (req, res) => {
        try {
            const { name, level, lng, lat } = req.body;
            await crowdReportModel.createReport(name, level, lng, lat);
            res.json({ success: true, message: "Cảm ơn bạn đã báo cáo!" });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = crowdReportController;


