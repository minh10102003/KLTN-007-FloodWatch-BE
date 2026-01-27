const pool = require('../config/db');

const sensorModel = {
    // Lấy tất cả sensors
    getAllSensors: async () => {
        const result = await pool.query(`
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
        `);
        return result.rows;
    },

    // Lấy thông tin một sensor cụ thể
    getSensorById: async (sensorId) => {
        const result = await pool.query(`
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
        `, [sensorId]);
        return result.rows[0];
    },

    // Tạo sensor mới
    createSensor: async (sensorData) => {
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
        await pool.query(`
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
        await pool.query(`
            INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
            VALUES ($1, $2, $3, 'system')
            ON CONFLICT (sensor_id) DO NOTHING
        `, [sensor_id, warning_threshold, danger_threshold]);

        return await sensorModel.getSensorById(sensor_id);
    },

    // Cập nhật sensor
    updateSensor: async (sensorId, sensorData) => {
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
            return await sensorModel.getSensorById(sensorId);
        }

        values.push(sensorId);
        await pool.query(`
            UPDATE sensors 
            SET ${updates.join(', ')}
            WHERE sensor_id = $${paramIndex}
        `, values);

        return await sensorModel.getSensorById(sensorId);
    },

    // Cập nhật ngưỡng báo động
    updateThresholds: async (sensorId, thresholds, updatedBy = 'admin') => {
        const { warning_threshold, danger_threshold } = thresholds;

        await pool.query(`
            INSERT INTO sensor_thresholds (sensor_id, warning_threshold, danger_threshold, updated_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (sensor_id) 
            DO UPDATE SET 
                warning_threshold = EXCLUDED.warning_threshold,
                danger_threshold = EXCLUDED.danger_threshold,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = EXCLUDED.updated_by
        `, [sensorId, warning_threshold, danger_threshold, updatedBy]);

        return await pool.query(`
            SELECT * FROM sensor_thresholds WHERE sensor_id = $1
        `, [sensorId]).then(result => result.rows[0]);
    },

    // Xóa sensor
    deleteSensor: async (sensorId) => {
        await pool.query('DELETE FROM sensors WHERE sensor_id = $1', [sensorId]);
        return { success: true };
    }
};

module.exports = sensorModel;
