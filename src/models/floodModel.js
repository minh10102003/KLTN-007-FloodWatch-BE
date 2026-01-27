const pool = require('../config/db');

const floodModel = {
    // Lấy tất cả dữ liệu ngập lụt (giới hạn 100 bản ghi mới nhất)
    getAllFloodLogs: async () => {
        const result = await pool.query(
            'SELECT * FROM flood_logs ORDER BY created_at DESC LIMIT 100'
        );
        return result.rows;
    },

    // Lấy dữ liệu ngập lụt kèm thông tin sensor (join với bảng sensors)
    // Lấy bản ghi MỚI NHẤT cho mỗi sensor_id - Bao gồm status và velocity
    getFloodDataWithSensors: async () => {
        const result = await pool.query(`
            SELECT DISTINCT ON (l.sensor_id) 
                l.sensor_id, 
                l.water_level, 
                l.velocity,
                l.status,
                l.created_at,
                s.location_name,
                s.model,
                s.installation_height,
                s.last_data_time,
                ST_X(s.coords::geometry) as lng, 
                ST_Y(s.coords::geometry) as lat
            FROM flood_logs l
            JOIN sensors s ON l.sensor_id = s.sensor_id
            WHERE s.is_active = TRUE
            ORDER BY l.sensor_id, l.created_at DESC
        `);
        return result.rows;
    },

    // Lấy dữ liệu lịch sử cho một sensor cụ thể
    getFloodHistoryBySensor: async (sensorId, limit = 100) => {
        const result = await pool.query(`
            SELECT 
                id,
                sensor_id,
                raw_distance,
                water_level,
                velocity,
                status,
                created_at
            FROM flood_logs
            WHERE sensor_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [sensorId, limit]);
        return result.rows;
    },

    // Lấy dữ liệu real-time với trạng thái (cho Frontend hiển thị)
    getRealTimeFloodData: async () => {
        const result = await pool.query(`
            SELECT DISTINCT ON (s.sensor_id)
                s.sensor_id,
                s.location_name,
                s.model,
                s.status as sensor_status,
                s.last_data_time,
                COALESCE(l.water_level, 0) as water_level,
                l.velocity,
                l.status as log_status,
                l.created_at,
                ST_X(s.coords::geometry) as lng,
                ST_Y(s.coords::geometry) as lat,
                t.warning_threshold,
                t.danger_threshold
            FROM sensors s
            LEFT JOIN flood_logs l ON s.sensor_id = l.sensor_id
            LEFT JOIN sensor_thresholds t ON s.sensor_id = t.sensor_id
            WHERE s.is_active = TRUE
            ORDER BY s.sensor_id, l.created_at DESC NULLS LAST
        `);
        return result.rows;
    }
};

module.exports = floodModel;

