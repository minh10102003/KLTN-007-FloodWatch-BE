const sensorModel = require('../models/sensorModel');
const auditLogRepository = require('../repositories/auditLogRepository');

const sensorController = {
    // Lấy tất cả sensors
    getAllSensors: async (req, res) => {
        try {
            const data = await sensorModel.getAllSensors();
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy thông tin một sensor cụ thể
    getSensorById: async (req, res) => {
        try {
            const { sensorId } = req.params;
            const data = await sensorModel.getSensorById(sensorId);
            
            if (!data) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Sensor không tồn tại' 
                });
            }
            
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Tạo sensor mới
    createSensor: async (req, res) => {
        try {
            const {
                sensor_id,
                location_name,
                lng,
                lat,
                hardware_type,
                model,
                installation_date,
                installation_height,
                warning_threshold,
                danger_threshold
            } = req.body;

            // Validate required fields
            if (!sensor_id || !location_name || !lng || !lat || !installation_height) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin bắt buộc: sensor_id, location_name, lng, lat, installation_height'
                });
            }

            const data = await sensorModel.createSensor({
                sensor_id,
                location_name,
                lng: parseFloat(lng),
                lat: parseFloat(lat),
                hardware_type,
                model,
                installation_date,
                installation_height: parseFloat(installation_height),
                warning_threshold: warning_threshold ? parseFloat(warning_threshold) : 10,
                danger_threshold: danger_threshold ? parseFloat(danger_threshold) : 30
            });
            if (req.user) {
                await auditLogRepository.log(req.user.id, 'sensor_created', 'sensor', data.sensor_id, data.location_name);
            }
            res.status(201).json({
                success: true,
                message: 'Tạo sensor thành công',
                data: data
            });
        } catch (err) {
            if (err.code === '23505') { // Unique violation
                return res.status(400).json({
                    success: false,
                    error: 'Sensor ID đã tồn tại'
                });
            }
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Cập nhật sensor
    updateSensor: async (req, res) => {
        try {
            const { sensorId } = req.params;
            const sensorData = req.body;

            // Validate sensor exists
            const existing = await sensorModel.getSensorById(sensorId);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: 'Sensor không tồn tại'
                });
            }

            const data = await sensorModel.updateSensor(sensorId, sensorData);
            if (req.user) {
                await auditLogRepository.log(req.user.id, 'sensor_updated', 'sensor', sensorId, JSON.stringify(sensorData));
            }
            res.json({
                success: true,
                message: 'Cập nhật sensor thành công',
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Cập nhật ngưỡng báo động
    updateThresholds: async (req, res) => {
        try {
            const { sensorId } = req.params;
            const { warning_threshold, danger_threshold } = req.body;
            const updatedBy = req.body.updated_by || 'admin';

            // Validate
            if (!warning_threshold || !danger_threshold) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: warning_threshold, danger_threshold'
                });
            }

            if (warning_threshold >= danger_threshold) {
                return res.status(400).json({
                    success: false,
                    error: 'warning_threshold phải nhỏ hơn danger_threshold'
                });
            }

            // Validate sensor exists
            const existing = await sensorModel.getSensorById(sensorId);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: 'Sensor không tồn tại'
                });
            }

            const data = await sensorModel.updateThresholds(
                sensorId,
                {
                    warning_threshold: parseFloat(warning_threshold),
                    danger_threshold: parseFloat(danger_threshold)
                },
                updatedBy
            );
            if (req.user) {
                await auditLogRepository.log(req.user.id, 'sensor_threshold_updated', 'sensor', sensorId, `warning=${warning_threshold}, danger=${danger_threshold}`);
            }
            res.json({
                success: true,
                message: 'Cập nhật ngưỡng báo động thành công',
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Xóa sensor
    deleteSensor: async (req, res) => {
        try {
            const { sensorId } = req.params;
            const existing = await sensorModel.getSensorById(sensorId);
            await sensorModel.deleteSensor(sensorId);
            if (req.user && existing) {
                await auditLogRepository.log(req.user.id, 'sensor_deleted', 'sensor', sensorId, existing.location_name);
            }
            res.json({
                success: true,
                message: 'Xóa sensor thành công'
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = sensorController;
