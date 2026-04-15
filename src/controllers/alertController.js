const alertRepository = require('../repositories/alertRepository');

function parseIntOrDefault(value, defaultValue) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
}

function handleError(res, err) {
    return res.status(500).json({ success: false, error: err.message });
}

const alertController = {
    // Lấy tất cả alerts
    async getAllAlerts(req, res) {
        try {
            const { status, severity, alert_type, sensor_id, limit, offset } = req.query;

            const alerts = await alertRepository.getAllAlerts({
                status,
                severity,
                alert_type,
                sensor_id,
                limit: parseIntOrDefault(limit, 100),
                offset: parseIntOrDefault(offset, 0)
            });

            return res.json({
                success: true,
                data: alerts
            });
        } catch (err) {
            return handleError(res, err);
        }
    },

    // Lấy alerts đang active
    async getActiveAlerts(req, res) {
        try {
            const activeAlerts = await alertRepository.getActiveAlerts();
            return res.json({
                success: true,
                data: activeAlerts
            });
        } catch (err) {
            return handleError(res, err);
        }
    },

    // Lấy alert theo ID
    async getAlertById(req, res) {
        try {
            const { alertId } = req.params;
            const alert = await alertRepository.getAlertById(alertId);

            if (!alert) {
                return res.status(404).json({
                    success: false,
                    error: 'Alert không tồn tại'
                });
            }

            return res.json({
                success: true,
                data: alert
            });
        } catch (err) {
            return handleError(res, err);
        }
    },

    // Acknowledge alert
    async acknowledgeAlert(req, res) {
        try {
            const { alertId } = req.params;
            const updatedAlert = await alertRepository.acknowledgeAlert(alertId, req.user.id);

            return res.json({
                success: true,
                message: 'Đã xác nhận alert',
                data: updatedAlert
            });
        } catch (err) {
            return handleError(res, err);
        }
    },

    // Resolve alert
    async resolveAlert(req, res) {
        try {
            const { alertId } = req.params;
            const resolvedAlert = await alertRepository.resolveAlert(alertId);

            return res.json({
                success: true,
                message: 'Đã đánh dấu alert đã xử lý',
                data: resolvedAlert
            });
        } catch (err) {
            return handleError(res, err);
        }
    },

    // Thống kê alerts
    async getAlertStats(req, res) {
        try {
            const stats = await alertRepository.countAlertsByStatus();
            return res.json({
                success: true,
                data: stats
            });
        } catch (err) {
            return handleError(res, err);
        }
    }
};

module.exports = alertController;