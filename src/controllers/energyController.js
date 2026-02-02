const energyRepository = require('../repositories/energyRepository');

const energyController = {
    // Tạo energy log mới (cho sensor gửi về)
    createEnergyLog: async (req, res) => {
        try {
            const { sensor_id, voltage, current, power, battery_level, power_source } = req.body;

            if (!sensor_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: sensor_id'
                });
            }

            const data = await energyRepository.createEnergyLog({
                sensor_id,
                voltage: voltage ? parseFloat(voltage) : null,
                current: current ? parseFloat(current) : null,
                power: power ? parseFloat(power) : null,
                battery_level: battery_level ? parseInt(battery_level) : null,
                power_source: power_source || 'grid'
            });

            // Cập nhật battery level và power source của sensor
            if (battery_level !== undefined || power_source) {
                await energyRepository.updateSensorEnergy(
                    sensor_id,
                    battery_level || null,
                    power_source || null
                );
            }

            res.status(201).json({
                success: true,
                message: 'Lưu energy log thành công',
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy energy logs theo sensor
    getEnergyLogsBySensor: async (req, res) => {
        try {
            const { sensorId } = req.params;
            const { limit } = req.query;
            const data = await energyRepository.getEnergyLogsBySensor(sensorId, parseInt(limit) || 100);
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy energy log mới nhất
    getLatestEnergyLog: async (req, res) => {
        try {
            const { sensorId } = req.params;
            const data = await energyRepository.getLatestEnergyLog(sensorId);
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy thống kê năng lượng
    getEnergyStats: async (req, res) => {
        try {
            const { sensorId } = req.params;
            const { hours } = req.query;
            const data = await energyRepository.getEnergyStats(sensorId, parseInt(hours) || 24);
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy sensors có mức pin thấp
    getLowBatterySensors: async (req, res) => {
        try {
            const { threshold } = req.query;
            const data = await energyRepository.getLowBatterySensors(parseInt(threshold) || 20);
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = energyController;

