const BaseRepository = require('./baseRepository');

/**
 * OTA Update Repository
 * Chứa tất cả các query liên quan đến OTA updates
 */
class OtaUpdateRepository extends BaseRepository {
    /**
     * Tạo OTA update mới
     * @param {Object} otaData - Dữ liệu OTA update
     */
    async createOtaUpdate(otaData) {
        const {
            sensor_id,
            firmware_version,
            firmware_url,
            checksum,
            scheduled_at,
            created_by
        } = otaData;

        const query = `
            INSERT INTO ota_updates (sensor_id, firmware_version, firmware_url, checksum, scheduled_at, created_by, update_status)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending')
            RETURNING *
        `;
        return await this.queryOne(query, [sensor_id, firmware_version, firmware_url, checksum, scheduled_at, created_by]);
    }

    /**
     * Lấy OTA updates theo sensor
     * @param {string} sensorId - Sensor ID
     */
    async getOtaUpdatesBySensor(sensorId) {
        const query = `
            SELECT 
                o.*,
                u.username as created_by_username,
                s.location_name
            FROM ota_updates o
            LEFT JOIN users u ON o.created_by = u.id
            LEFT JOIN sensors s ON o.sensor_id = s.sensor_id
            WHERE o.sensor_id = $1
            ORDER BY o.created_at DESC
        `;
        return await this.queryAll(query, [sensorId]);
    }

    /**
     * Lấy OTA update theo ID
     * @param {number} otaId - OTA Update ID
     */
    async getOtaUpdateById(otaId) {
        const query = `
            SELECT 
                o.*,
                u.username as created_by_username,
                s.location_name
            FROM ota_updates o
            LEFT JOIN users u ON o.created_by = u.id
            LEFT JOIN sensors s ON o.sensor_id = s.sensor_id
            WHERE o.id = $1
        `;
        return await this.queryOne(query, [otaId]);
    }

    /**
     * Cập nhật trạng thái OTA update
     * @param {number} otaId - OTA Update ID
     * @param {string} status - Trạng thái mới
     * @param {string} errorMessage - Thông báo lỗi (nếu có)
     */
    async updateOtaStatus(otaId, status, errorMessage = null) {
        let query;
        let params;

        if (status === 'in_progress') {
            query = `
                UPDATE ota_updates 
                SET update_status = $1, started_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;
            params = [status, otaId];
        } else if (status === 'completed') {
            query = `
                UPDATE ota_updates 
                SET update_status = $1, completed_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;
            params = [status, otaId];
        } else if (status === 'failed') {
            query = `
                UPDATE ota_updates 
                SET update_status = $1, error_message = $2, completed_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `;
            params = [status, errorMessage, otaId];
        } else {
            query = `
                UPDATE ota_updates 
                SET update_status = $1
                WHERE id = $2
                RETURNING *
            `;
            params = [status, otaId];
        }

        return await this.queryOne(query, params);
    }

    /**
     * Lấy OTA updates đang pending
     */
    async getPendingOtaUpdates() {
        const query = `
            SELECT 
                o.*,
                s.location_name,
                s.firmware_version as current_firmware
            FROM ota_updates o
            LEFT JOIN sensors s ON o.sensor_id = s.sensor_id
            WHERE o.update_status = 'pending'
            AND (o.scheduled_at IS NULL OR o.scheduled_at <= NOW())
            ORDER BY o.created_at ASC
        `;
        return await this.queryAll(query);
    }

    /**
     * Cập nhật firmware version của sensor sau khi OTA thành công
     * @param {string} sensorId - Sensor ID
     * @param {string} firmwareVersion - Firmware version mới
     */
    async updateSensorFirmware(sensorId, firmwareVersion) {
        const query = `
            UPDATE sensors 
            SET firmware_version = $1, last_ota_update = CURRENT_TIMESTAMP
            WHERE sensor_id = $2
            RETURNING sensor_id, firmware_version, last_ota_update
        `;
        return await this.queryOne(query, [firmwareVersion, sensorId]);
    }
}

module.exports = new OtaUpdateRepository();

