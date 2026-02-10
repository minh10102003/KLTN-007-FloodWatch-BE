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

            // Validate reportId
            const reportIdNum = parseInt(reportId);
            if (isNaN(reportIdNum)) {
                return res.status(400).json({
                    success: false,
                    error: 'reportId phải là số'
                });
            }

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'Action phải là "approve" hoặc "reject"'
                });
            }

            const moderationStatus = action === 'approve' ? 'approved' : 'rejected';
            
            // Kiểm tra báo cáo có tồn tại không
            const existingReport = await crowdReportRepository.getReportById(reportIdNum);
            if (!existingReport) {
                return res.status(404).json({
                    success: false,
                    error: 'Báo cáo không tồn tại'
                });
            }

            console.log(`📝 [Moderation] ${req.user.username} (ID: ${req.user.id}) ${action}ing report ${reportIdNum} (current status: ${existingReport.moderation_status})`);

            const data = await crowdReportRepository.moderateReport(
                reportIdNum,
                moderationStatus,
                req.user.id,
                rejection_reason
            );

            if (!data) {
                return res.status(500).json({
                    success: false,
                    error: 'Không thể cập nhật trạng thái báo cáo'
                });
            }

            console.log(`✅ [Moderation] Report ${reportIdNum} updated to ${moderationStatus} by ${req.user.username}`);

            res.json({
                success: true,
                message: `Đã ${action === 'approve' ? 'duyệt' : 'từ chối'} báo cáo`,
                data: data
            });
        } catch (err) {
            console.error('❌ [Moderation] Error:', err);
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

