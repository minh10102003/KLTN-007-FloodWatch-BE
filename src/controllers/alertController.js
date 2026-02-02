const alertRepository = require('../repositories/alertRepository');

const alertController = {
    // Lấy tất cả alerts
    getAllAlerts: async (req, res) => {
        try {
            const { status, severity, alert_type, sensor_id, limit, offset } = req.query;
            const data = await alertRepository.getAllAlerts({
                status,
                severity,
                alert_type,
                sensor_id,
                limit: parseInt(limit) || 100,
                offset: parseInt(offset) || 0
            });
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy alerts đang active
    getActiveAlerts: async (req, res) => {
        try {
            const data = await alertRepository.getActiveAlerts();
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy alert theo ID
    getAlertById: async (req, res) => {
        try {
            const { alertId } = req.params;
            const data = await alertRepository.getAlertById(alertId);
            
            if (!data) {
                return res.status(404).json({
                    success: false,
                    error: 'Alert không tồn tại'
                });
            }

            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Acknowledge alert
    acknowledgeAlert: async (req, res) => {
        try {
            const { alertId } = req.params;
            const data = await alertRepository.acknowledgeAlert(alertId, req.user.id);
            res.json({
                success: true,
                message: 'Đã xác nhận alert',
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Resolve alert
    resolveAlert: async (req, res) => {
        try {
            const { alertId } = req.params;
            const data = await alertRepository.resolveAlert(alertId);
            res.json({
                success: true,
                message: 'Đã đánh dấu alert đã xử lý',
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Thống kê alerts
    getAlertStats: async (req, res) => {
        try {
            const data = await alertRepository.countAlertsByStatus();
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = alertController;

