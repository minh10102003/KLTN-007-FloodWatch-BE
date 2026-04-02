const fusionModel = require('../models/fusionModel');

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

const fusionController = {
    getFusionPoints: async (req, res) => {
        try {
            const bounds = parseBounds(req.query);
            const crowdHours = req.query.crowd_hours;
            const sensorHours = req.query.sensor_hours;
            const includeSensors = req.query.include_sensors !== 'false';

            const data = await fusionModel.getFusionPoints({
                crowdHours,
                sensorHours,
                bounds,
                includeSensors
            });

            res.json({
                success: true,
                meta: data.meta,
                data: {
                    sensors: data.sensors,
                    crowd: data.crowd
                }
            });
        } catch (err) {
            const code = err.statusCode || 500;
            res.status(code).json({ success: false, error: err.message });
        }
    }
};

module.exports = fusionController;
