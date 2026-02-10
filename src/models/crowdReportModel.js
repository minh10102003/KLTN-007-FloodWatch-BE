const crowdReportRepository = require('../repositories/crowdReportRepository');

/**
 * Crowd Report Model
 * Sử dụng CrowdReportRepository để thực hiện các thao tác với database
 */
const crowdReportModel = {
    // Lấy các báo cáo từ người dân trong vòng 24 giờ qua
    getRecentReports: async (hours = 24, moderationStatus = null, validationStatus = null) => {
        return await crowdReportRepository.getRecentReports(hours, moderationStatus, validationStatus);
    },

    // Tạo báo cáo mới từ người dân với xác minh chéo
    createReport: async (name, reporterId, level, lng, lat, photoUrl = null, locationDescription = null) => {
        return await crowdReportRepository.createReport(name, reporterId, level, lng, lat, photoUrl, locationDescription);
    },

    // Lấy tất cả báo cáo (không giới hạn thời gian) - DEPRECATED: Dùng getUserReports thay thế
    getAllReports: async (limit = 100, moderationStatus = null) => {
        return await crowdReportRepository.getAllReports(limit, moderationStatus);
    },

    // Lấy tất cả báo cáo của một user cụ thể
    getUserReports: async (userId, limit = 1000, moderationStatus = null) => {
        return await crowdReportRepository.getUserReports(userId, limit, moderationStatus);
    }
};

module.exports = crowdReportModel;

