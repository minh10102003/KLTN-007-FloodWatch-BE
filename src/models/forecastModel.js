const floodRepository = require('../repositories/floodRepository');
const sensorRepository = require('../repositories/sensorRepository');
const forecastService = require('../services/forecastService');

const forecastModel = {
    /**
     * @param {string} sensorId
     * @param {number} horizonMinutes 15–120
     * @param {number} sampleMinutes cửa sổ lấy log để fit
     */
    async getSensorShortForecast(sensorId, horizonMinutes = 60, sampleMinutes = 90) {
        const sensor = await sensorRepository.getSensorById(sensorId);
        if (!sensor) {
            const err = new Error('Không tìm thấy sensor');
            err.statusCode = 404;
            throw err;
        }
        if (!sensor.is_active) {
            const err = new Error('Sensor không active');
            err.statusCode = 400;
            throw err;
        }

        const logs = await floodRepository.getFloodLogsForForecast(sensorId, sampleMinutes);
        const thresholds = {
            warning_threshold: sensor.warning_threshold,
            danger_threshold: sensor.danger_threshold
        };
        const forecast = forecastService.buildForecast(logs, thresholds, horizonMinutes);
        return {
            sensor_id: sensorId,
            location_name: sensor.location_name,
            ...forecast
        };
    }
};

module.exports = forecastModel;
