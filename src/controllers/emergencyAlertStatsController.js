const emergencyAlertSendLogRepository = require('../repositories/emergencyAlertSendLogRepository');

const emergencyAlertStatsController = {
    getSummary: async (req, res) => {
        try {
            const hours = req.query.hours;
            const data = await emergencyAlertSendLogRepository.getSummaryStats(hours);
            res.json({ success: true, data });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = emergencyAlertStatsController;
