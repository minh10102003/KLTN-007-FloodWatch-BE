const sensorRepository = require('../repositories/sensorRepository');

/**
 * Sensor Model
 * Sử dụng SensorRepository để thực hiện các thao tác với database
 */
const sensorModel = {
    // Lấy tất cả sensors
    getAllSensors: async () => {
        return await sensorRepository.getAllSensors();
    },

    // Lấy thông tin một sensor cụ thể
    getSensorById: async (sensorId) => {
        return await sensorRepository.getSensorById(sensorId);
    },

    // Tạo sensor mới
    createSensor: async (sensorData) => {
        return await sensorRepository.createSensor(sensorData);
    },

    // Cập nhật sensor
    updateSensor: async (sensorId, sensorData) => {
        return await sensorRepository.updateSensor(sensorId, sensorData);
    },

    // Cập nhật ngưỡng báo động
    updateThresholds: async (sensorId, thresholds, updatedBy = 'admin') => {
        return await sensorRepository.updateThresholds(sensorId, thresholds, updatedBy);
    },

    // Xóa sensor
    deleteSensor: async (sensorId) => {
        return await sensorRepository.deleteSensor(sensorId);
    }
};

module.exports = sensorModel;
