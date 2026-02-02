const otaUpdateRepository = require('../repositories/otaUpdateRepository');

const otaController = {
    // Tạo OTA update mới
    createOtaUpdate: async (req, res) => {
        try {
            const { sensor_id, firmware_version, firmware_url, checksum, scheduled_at } = req.body;

            if (!sensor_id || !firmware_version || !firmware_url) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin bắt buộc: sensor_id, firmware_version, firmware_url'
                });
            }

            const data = await otaUpdateRepository.createOtaUpdate({
                sensor_id,
                firmware_version,
                firmware_url,
                checksum,
                scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
                created_by: req.user.id
            });

            res.status(201).json({
                success: true,
                message: 'Tạo OTA update thành công',
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy OTA updates theo sensor
    getOtaUpdatesBySensor: async (req, res) => {
        try {
            const { sensorId } = req.params;
            const data = await otaUpdateRepository.getOtaUpdatesBySensor(sensorId);
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy OTA update theo ID
    getOtaUpdateById: async (req, res) => {
        try {
            const { otaId } = req.params;
            const data = await otaUpdateRepository.getOtaUpdateById(parseInt(otaId));
            
            if (!data) {
                return res.status(404).json({
                    success: false,
                    error: 'OTA update không tồn tại'
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

    // Lấy OTA updates đang pending
    getPendingOtaUpdates: async (req, res) => {
        try {
            const data = await otaUpdateRepository.getPendingOtaUpdates();
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Cập nhật trạng thái OTA (cho sensor gọi về)
    updateOtaStatus: async (req, res) => {
        try {
            const { otaId } = req.params;
            const { status, error_message } = req.body;

            if (!['in_progress', 'completed', 'failed'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Status phải là: in_progress, completed, hoặc failed'
                });
            }

            const data = await otaUpdateRepository.updateOtaStatus(
                parseInt(otaId),
                status,
                error_message
            );

            // Nếu OTA thành công, cập nhật firmware version của sensor
            if (status === 'completed' && data) {
                await otaUpdateRepository.updateSensorFirmware(
                    data.sensor_id,
                    data.firmware_version
                );
            }

            res.json({
                success: true,
                message: 'Cập nhật trạng thái OTA thành công',
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = otaController;

