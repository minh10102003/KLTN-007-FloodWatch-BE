const crowdReportRepository = require('../repositories/crowdReportRepository');

/**
 * Crowd Report Model
 * Sử dụng CrowdReportRepository để thực hiện các thao tác với database
 */
const crowdReportModel = {
    // Lấy các báo cáo từ người dân trong vòng 24 giờ qua
    getRecentReports: async () => {
        return await crowdReportRepository.getRecentReports();
    },

    // Tạo báo cáo mới từ người dân với xác minh chéo
    createReport: async (name, reporterId, level, lng, lat, photoUrl = null) => {
        return await crowdReportRepository.createReport(name, reporterId, level, lng, lat, photoUrl);
    },

    // Lấy tất cả báo cáo (không giới hạn thời gian)
    getAllReports: async (limit = 100) => {
        return await crowdReportRepository.getAllReports(limit);
    }
};

module.exports = crowdReportModel;

