const forecastModel = require('../models/forecastModel');

const forecastController = {
    getSensorForecast: async (req, res) => {
        try {
            const { sensorId } = req.params;
            const horizon = Math.min(120, Math.max(15, parseInt(req.query.horizon, 10) || 60));
            const sampleWindow = Math.min(24 * 60, Math.max(15, parseInt(req.query.sample_minutes, 10) || 90));

            const data = await forecastModel.getSensorShortForecast(sensorId, horizon, sampleWindow);
            res.json({ success: true, data });
        } catch (err) {
            const code = err.statusCode || 500;
            res.status(code).json({ success: false, error: err.message });
        }
    }
};

module.exports = forecastController;
