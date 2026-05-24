const crowdReportRepository = require('../repositories/crowdReportRepository');
const crowdReportAutoApproveRepository = require('../repositories/crowdReportAutoApproveRepository');
const userModel = require('../models/userModel');
const { withFullPhotoUrls } = require('../utils/photoUrl');
const { withReportConfidence } = require('../utils/reportConfidence');
const { withReportDisplayStatus } = require('../utils/reportDisplayStatus');
const { emitAdminNotification } = require('../socket/adminSocket');

function enrichReportRows(req, data) {
    return withFullPhotoUrls(req, withReportDisplayStatus(withReportConfidence(data)));
}

const reportModerationController = {
    // Lấy tất cả báo cáo (kể cả cũ) - Admin/Moderator, không giới hạn theo thời gian
    getAllReports: async (req, res) => {
        try {
            const { limit, moderation_status } = req.query;
            const data = await crowdReportRepository.getAllReports(
                parseInt(limit) || 500,
                moderation_status || null
            );
            res.json({
                success: true,
                data: enrichReportRows(req, data)
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy báo cáo cần kiểm duyệt (trả photo_url full URL để Admin/Mod xem được ảnh)
    getPendingReports: async (req, res) => {
        try {
            const { limit } = req.query;
            const data = await crowdReportRepository.getPendingModerationReports(parseInt(limit) || 50);
            res.json({
                success: true,
                data: enrichReportRows(req, data)
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

            if (existingReport.auto_approved === true) {
                return res.status(409).json({
                    success: false,
                    error: 'Báo cáo đã được tự động duyệt, không thể duyệt/từ chối thủ công'
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

            // Cách C: cập nhật điểm tin cậy reporter khi duyệt/từ chối (Cách B)
            if (data.reporter_id) {
                const reporterUserId = parseInt(data.reporter_id, 10);
                if (!isNaN(reporterUserId)) {
                    userModel.applyReporterReliabilityEvent(
                        reporterUserId,
                        moderationStatus === 'approved' ? 'approved' : 'rejected',
                        data.rejection_reason || null
                    ).catch((err) => console.error('❌ [Reliability] applyReporterReliabilityEvent:', err.message));
                }
            }

            console.log(`✅ [Moderation] Report ${reportIdNum} updated to ${moderationStatus} by ${req.user.username}`);

            if (action === 'approve') {
                emitAdminNotification({ type: 'report_approved', reportId: reportIdNum });
            } else {
                emitAdminNotification({ type: 'report_rejected', reportId: reportIdNum });
            }

            res.json({
                success: true,
                message: `Đã ${action === 'approve' ? 'duyệt' : 'từ chối'} báo cáo`,
                data: enrichReportRows(req, data)
            });
        } catch (err) {
            console.error('❌ [Moderation] Error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },

    /**
     * POST /api/reports/:reportId/skip-auto-approve
     * Moderator loại báo cáo khỏi luồng tự duyệt cụm — chỉ duyệt thủ công.
     */
    skipAutoApprove: async (req, res) => {
        try {
            const reportIdNum = parseInt(req.params.reportId, 10);
            if (Number.isNaN(reportIdNum)) {
                return res.status(400).json({ success: false, error: 'reportId phải là số' });
            }

            const existingReport = await crowdReportRepository.getReportById(reportIdNum);
            if (!existingReport) {
                return res.status(404).json({ success: false, error: 'Báo cáo không tồn tại' });
            }

            if (existingReport.auto_approved === true) {
                return res.status(409).json({
                    success: false,
                    error: 'Báo cáo đã được tự động duyệt, không thể bỏ qua auto-approve'
                });
            }

            if (existingReport.moderation_status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Chỉ áp dụng cho báo cáo đang chờ duyệt (pending)'
                });
            }

            if (existingReport.skip_auto_approve === true) {
                return res.json({
                    success: true,
                    message: 'Báo cáo đã được đánh dấu bỏ qua auto-approve',
                    data: enrichReportRows(req, existingReport)
                });
            }

            const updated = await crowdReportAutoApproveRepository.setSkipAutoApprove(reportIdNum);
            if (!updated) {
                return res.status(500).json({
                    success: false,
                    error: 'Không thể cập nhật skip_auto_approve'
                });
            }

            const data = await crowdReportRepository.getReportById(reportIdNum);
            console.log(
                `📝 [Moderation] ${req.user.username} (ID: ${req.user.id}) skip-auto-approve report ${reportIdNum}`
            );

            res.json({
                success: true,
                message: 'Đã bỏ qua auto-approve — báo cáo chỉ duyệt thủ công',
                data: enrichReportRows(req, data)
            });
        } catch (err) {
            console.error('❌ [Moderation] skip-auto-approve:', err);
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

