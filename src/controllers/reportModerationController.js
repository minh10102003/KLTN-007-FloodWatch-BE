const crowdReportRepository = require('../repositories/crowdReportRepository');

const reportModerationController = {
    // Lấy báo cáo cần kiểm duyệt
    getPendingReports: async (req, res) => {
        try {
            const { limit } = req.query;
            const data = await crowdReportRepository.getPendingModerationReports(parseInt(limit) || 50);
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Kiểm duyệt báo cáo (approve/reject)
    moderateReport: async (req, res) => {
        try {
            const { reportId } = req.params;
            const { action, rejection_reason } = req.body; // action: 'approve' hoặc 'reject'

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'Action phải là "approve" hoặc "reject"'
                });
            }

            const moderationStatus = action === 'approve' ? 'approved' : 'rejected';
            const data = await crowdReportRepository.moderateReport(
                reportId,
                moderationStatus,
                req.user.id,
                rejection_reason
            );

            res.json({
                success: true,
                message: `Đã ${action === 'approve' ? 'duyệt' : 'từ chối'} báo cáo`,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy xếp hạng tin cậy
    getReliabilityRanking: async (req, res) => {
        try {
            const { limit } = req.query;
            const data = await crowdReportRepository.getReliabilityRanking(parseInt(limit) || 100);
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = reportModerationController;

