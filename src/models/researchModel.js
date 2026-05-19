const fusionRepository = require('../repositories/fusionRepository');
const researchRepository = require('../repositories/researchRepository');
const researchService = require('../services/researchService');

const researchModel = {
    async evaluateFusion(opts = {}) {
        const crowdHours = Math.min(168, Math.max(1, parseInt(opts.crowdHours, 10) || 72));
        const sensorHours = Math.min(72, Math.max(1, parseInt(opts.sensorHours, 10) || 6));
        const bounds = opts.bounds || null;
        const rows = await fusionRepository.getCrowdReportsWithNearestSensor(crowdHours, sensorHours, bounds);
        const metrics = researchService.evaluateFusionAgainstNearestSensor(rows);
        return {
            meta: { crowd_report_hours: crowdHours, sensor_log_hours: sensorHours },
            data: metrics
        };
    },

    async getColdStartHotspots(opts = {}) {
        const hours = Math.min(24 * 14, Math.max(1, parseInt(opts.hours, 10) || 72));
        const sensorHours = Math.min(72, Math.max(1, parseInt(opts.sensorHours, 10) || 6));
        const radiusM = Math.min(10000, Math.max(100, parseInt(opts.radiusM, 10) || 1500));
        const minReports = Math.min(50, Math.max(1, parseInt(opts.minReports, 10) || 2));
        const bounds = opts.bounds || null;
        const rows = await researchRepository.getColdStartHotspots({
            hours,
            sensorHours,
            radiusM,
            minReports,
            bounds
        });
        return {
            meta: {
                report_hours: hours,
                sensor_hours: sensorHours,
                no_sensor_radius_m: radiusM,
                min_reports_per_hotspot: minReports,
                sensor_coverage_note:
                    'Chỉ tính sensor is_active có flood_logs trong sensor_hours (cùng D1 evaluation).'
            },
            data: rows
        };
    },

    async getColdStartHotspotsDebug(opts = {}) {
        const hours = Math.min(24 * 14, Math.max(1, parseInt(opts.hours, 10) || 72));
        const sensorHours = Math.min(72, Math.max(1, parseInt(opts.sensorHours, 10) || 6));
        const radiusM = Math.min(10000, Math.max(100, parseInt(opts.radiusM, 10) || 1500));
        const bounds = opts.bounds || null;
        const stats = await researchRepository.getColdStartDistanceDebug({
            hours,
            sensorHours,
            radiusM,
            bounds
        });
        return {
            meta: {
                report_hours: hours,
                sensor_hours: sensorHours,
                no_sensor_radius_m: radiusM,
                sensor_coverage_note:
                    'Histogram khoảng cách tới sensor gần nhất (chỉ sensor có log trong sensor_hours).'
            },
            data: stats
        };
    }
};

module.exports = researchModel;
