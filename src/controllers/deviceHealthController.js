const sensorRepository = require('../repositories/sensorRepository');
const deviceHealthService = require('../services/deviceHealthService');

const deviceHealthController = {
    getDevicesHealth: async (req, res) => {
        try {
            const rows = await sensorRepository.getDevicesHealthOverview();
            const data = rows.map((r) => deviceHealthService.formatOverviewRow(r));
            const summary = data.reduce(
                (acc, d) => {
                    acc[d.health] = (acc[d.health] || 0) + 1;
                    return acc;
                },
                {}
            );
            res.json({
                success: true,
                meta: {
                    thresholds_minutes: deviceHealthService.readThresholds(),
                    generated_at: new Date().toISOString()
                },
                summary,
                data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = deviceHealthController;
