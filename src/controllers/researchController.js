const researchModel = require('../models/researchModel');

function parseBounds(q) {
    const minLng = parseFloat(q.min_lng);
    const maxLng = parseFloat(q.max_lng);
    const minLat = parseFloat(q.min_lat);
    const maxLat = parseFloat(q.max_lat);
    if (![minLng, maxLng, minLat, maxLat].every((x) => Number.isFinite(x))) {
        return null;
    }
    if (minLng >= maxLng || minLat >= maxLat) {
        const err = new Error('min_lng < max_lng và min_lat < max_lat');
        err.statusCode = 400;
        throw err;
    }
    return { minLng, maxLng, minLat, maxLat };
}

const researchController = {
    evaluateFusion: async (req, res) => {
        try {
            const bounds = parseBounds(req.query);
            const result = await researchModel.evaluateFusion({
                crowdHours: req.query.crowd_hours,
                sensorHours: req.query.sensor_hours,
                bounds
            });
            res.json({ success: true, meta: result.meta, data: result.data });
        } catch (err) {
            res.status(err.statusCode || 500).json({ success: false, error: err.message });
        }
    },

    getColdStartHotspots: async (req, res) => {
        try {
            const bounds = parseBounds(req.query);
            const result = await researchModel.getColdStartHotspots({
                hours: req.query.report_hours,
                sensorHours: req.query.sensor_hours,
                radiusM: req.query.no_sensor_radius_m,
                minReports: req.query.min_reports,
                bounds
            });
            res.json({ success: true, meta: result.meta, data: result.data });
        } catch (err) {
            res.status(err.statusCode || 500).json({ success: false, error: err.message });
        }
    },

    getColdStartHotspotsDebug: async (req, res) => {
        try {
            const bounds = parseBounds(req.query);
            const result = await researchModel.getColdStartHotspotsDebug({
                hours: req.query.report_hours,
                sensorHours: req.query.sensor_hours,
                radiusM: req.query.no_sensor_radius_m,
                bounds
            });
            res.json({ success: true, meta: result.meta, data: result.data });
        } catch (err) {
            res.status(err.statusCode || 500).json({ success: false, error: err.message });
        }
    }
};

module.exports = researchController;
