const BaseRepository = require('./baseRepository');

/**
 * Sensor Repository
 * Chứa tất cả các query liên quan đến sensors và sensor_thresholds
 */
class SensorRepository extends BaseRepository {
    /**
     * Lấy tất cả sensors với thông tin thresholds
     */
    async getAllSensors() {
        const query = `
            SELECT 
                s.sensor_id,
                s.location_name,
                s.model,
                s.hardware_type,
                s.installation_date,
                s.installation_height,
                s.is_active,
                s.status,
                s.last_data_time,
                ST_X(s.coords::geometry) as lng,
                ST_Y(s.coords::geometry) as lat,
                t.warning_threshold,
                t.danger_threshold,
                s.created_at
            FROM sensors s
            LEFT JOIN sensor_thresholds t ON s.sensor_id = t.sensor_id
            ORDER BY s.created_at DESC
        `;
        return await this.queryAll(query);
    }

    /**
     * Lấy thông tin một sensor cụ thể
     * @param {string} sensorId - ID của sensor
     */
    async getSensorById(sensorId) {
        const query = `
            SELECT 
                s.sensor_id,
                s.location_name,
                s.model,
                s.hardware_type,
                s.installation_date,
                s.installation_height,
                s.is_active,
                s.status,
                s.last_data_time,
                ST_X(s.coords::geometry) as lng,
                ST_Y(s.coords::geometry) as lat,
                t.warning_threshold,
                t.danger_threshold,
                s.created_at
            FROM sensors s
            LEFT JOIN sensor_thresholds t ON s.sensor_id = t.sensor_id
            WHERE s.sensor_id = $1
        `;
        return await this.queryOne(query, [sensorId]);
    }

    /**
     * Tạo sensor mới
     * @param {Object} sensorData - Dữ liệu sensor
     */
    async createSensor(sensorData) {
        const {
            sensor_id,
            location_name,
            lng,
            lat,
            hardware_type,
            model,
            installation_date,
            installation_height,
            warning_threshold = 10,
            danger_threshold = 30
        } = sensorData;

        // Tạo sensor
        await this.query(`
            INSERT INTO sensors (
                sensor_id, 
                location_name, 
                coords, 
                hardware_type,
                model,
                installation_date,
                installation_height
            )
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, $8)
        `, [sensor_id, location_name, lng, lat, hardware_type, model, installation_date, installation_height]);

        // Tạo threshold mặc định
        await this.query(`
            INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
            VALUES ($1, $2, $3, 'system')
            ON CONFLICT (sensor_id) DO NOTHING
        `, [sensor_id, warning_threshold, danger_threshold]);

        return await this.getSensorById(sensor_id);
    }

    /**
     * Cập nhật sensor
     * @param {string} sensorId - ID của sensor
     * @param {Object} sensorData - Dữ liệu cần cập nhật
     */
    async updateSensor(sensorId, sensorData) {
        const {
            location_name,
            lng,
            lat,
            hardware_type,
            model,
            installation_date,
            installation_height,
            is_active
        } = sensorData;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (location_name !== undefined) {
            updates.push(`location_name = $${paramIndex++}`);
            values.push(location_name);
        }
        if (lng !== undefined && lat !== undefined) {
            updates.push(`coords = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography`);
            values.push(lng, lat);
            paramIndex += 2;
        }
        if (hardware_type !== undefined) {
            updates.push(`hardware_type = $${paramIndex++}`);
            values.push(hardware_type);
        }
        if (model !== undefined) {
            updates.push(`model = $${paramIndex++}`);
            values.push(model);
        }
        if (installation_date !== undefined) {
            updates.push(`installation_date = $${paramIndex++}`);
            values.push(installation_date);
        }
        if (installation_height !== undefined) {
            updates.push(`installation_height = $${paramIndex++}`);
            values.push(installation_height);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return await this.getSensorById(sensorId);
        }

        values.push(sensorId);
        await this.query(`
            UPDATE sensors 
            SET ${updates.join(', ')}
            WHERE sensor_id = $${paramIndex}
        `, values);

        return await this.getSensorById(sensorId);
    }

    /**
     * Cập nhật ngưỡng báo động
     * @param {string} sensorId - ID của sensor
     * @param {Object} thresholds - Object chứa warning_threshold và danger_threshold
     * @param {string} updatedBy - Người cập nhật
     */
    async updateThresholds(sensorId, thresholds, updatedBy = 'admin') {
        const { warning_threshold, danger_threshold } = thresholds;

        await this.query(`
            INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (sensor_id) 
            DO UPDATE SET 
                warning_threshold = EXCLUDED.warning_threshold,
                danger_threshold = EXCLUDED.danger_threshold,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = EXCLUDED.updated_by
        `, [sensorId, warning_threshold, danger_threshold, updatedBy]);

        return await this.queryOne(`
            SELECT * FROM sensor_thresholds WHERE sensor_id = $1
        `, [sensorId]);
    }

    /**
     * Xóa sensor
     * @param {string} sensorId - ID của sensor
     */
    async deleteSensor(sensorId) {
        await this.query('DELETE FROM sensors WHERE sensor_id = $1', [sensorId]);
        return { success: true };
    }

    /**
     * Tìm sensors trong bán kính nhất định
     * @param {number} lng - Longitude
     * @param {number} lat - Latitude
     * @param {number} radius - Bán kính (mét)
     */
    async findSensorsInRadius(lng, lat, radius = 500) {
        const query = `
            SELECT 
                s.sensor_id,
                s.location_name,
                l.water_level,
                l.status,
                ST_Distance(s.coords, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance
            FROM sensors s
            LEFT JOIN LATERAL (
                SELECT water_level, status
                FROM flood_logs
                WHERE sensor_id = s.sensor_id
                ORDER BY created_at DESC
                LIMIT 1
            ) l ON true
            WHERE s.is_active = TRUE
            AND ST_Distance(s.coords, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) < $3
            ORDER BY distance
        `;
        return await this.queryAll(query, [lng, lat, radius]);
    }

    /**
     * Lấy installation_height của sensor
     * @param {string} sensorId - ID của sensor
     */
    async getInstallationHeight(sensorId) {
        const query = `
            SELECT installation_height 
            FROM sensors 
            WHERE sensor_id = $1 AND is_active = TRUE
        `;
        const result = await this.queryOne(query, [sensorId]);
        return result ? result.installation_height : null;
    }

    /**
     * Cập nhật health check cho sensor
     * @param {string} sensorId - ID của sensor
     * @param {string} status - Trạng thái mới
     */
    async updateSensorHealth(sensorId, status) {
        const query = `
            UPDATE sensors 
            SET last_data_time = NOW(), status = $1 
            WHERE sensor_id = $2
        `;
        await this.query(query, [status, sensorId]);
    }

    /**
     * Kiểm tra và cập nhật sensor offline (nếu không có dữ liệu > 5 phút)
     * @returns {Promise<Array>} Danh sách sensor_id đã được đánh dấu offline
     */
    async checkSensorHealth() {
        const query = `
            UPDATE sensors 
            SET status = 'offline' 
            WHERE is_active = TRUE 
            AND (last_data_time IS NULL OR last_data_time < NOW() - INTERVAL '5 minutes')
            AND status != 'offline'
            RETURNING sensor_id
        `;
        return await this.queryAll(query);
    }

    /**
     * Lấy thresholds của sensor
     * @param {string} sensorId - ID của sensor
     */
    async getThresholds(sensorId) {
        const query = `
            SELECT warning_threshold, danger_threshold 
            FROM sensor_thresholds 
            WHERE sensor_id = $1
        `;
        return await this.queryOne(query, [sensorId]);
    }
}

module.exports = new SensorRepository();

