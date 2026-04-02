const fusionRepository = require('../repositories/fusionRepository');
const fusionService = require('../services/fusionService');

const fusionModel = {
    /**
     * @param {object} opts
     * @param {number} [opts.crowdHours=24]
     * @param {number} [opts.sensorHours=1]
     * @param {{ minLng, maxLng, minLat, maxLat }|null} [opts.bounds]
     * @param {boolean} [opts.includeSensors=true]
     */
    async getFusionPoints(opts = {}) {
        const crowdHours = Math.min(168, Math.max(1, parseInt(opts.crowdHours, 10) || 24));
        const sensorHours = Math.min(72, Math.max(1, parseInt(opts.sensorHours, 10) || 1));
        const bounds = opts.bounds || null;
        const includeSensors = opts.includeSensors !== false;

        const [sensors, crowdRows] = await Promise.all([
            includeSensors
                ? fusionRepository.getSensorLatestInWindow(sensorHours, bounds)
                : Promise.resolve([]),
            fusionRepository.getCrowdReportsWithNearestSensor(crowdHours, sensorHours, bounds)
        ]);

        const sensorsOut = includeSensors
            ? sensors.map((r) => fusionService.formatSensorRow(r))
            : [];
        const crowdOut = crowdRows.map((r) => fusionService.formatCrowdRow(r));

        return {
            sensors: sensorsOut,
            crowd: crowdOut,
            meta: {
                crowd_report_hours: crowdHours,
                sensor_log_hours: sensorHours,
                fusion_params: fusionService.readParams()
            }
        };
    }
};

module.exports = fusionModel;
