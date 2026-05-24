const crowdReportAutoApproveRepository = require('../repositories/crowdReportAutoApproveRepository');

const SUMMARY_KEYS = [
    'total_active',
    'auto_approved',
    'pending_manual_review',
    'sensor_verified',
    'pending_auto_approve'
];

const reportSummaryController = {
    getSummary: async (req, res) => {
        try {
            const row = await crowdReportAutoApproveRepository.getSummaryStats();
            const data = {};
            for (const key of SUMMARY_KEYS) {
                data[key] = Number(row?.[key] ?? 0);
            }
            res.json({ success: true, data });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = reportSummaryController;
