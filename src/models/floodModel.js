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
    // Lấy bản ghi MỚI NHẤT cho mỗi sensor_id
    getFloodDataWithSensors: async () => {
        const result = await pool.query(`
            SELECT DISTINCT ON (l.sensor_id) 
                l.sensor_id, l.water_level, l.created_at,
                s.location_name, 
                ST_X(s.coords::geometry) as lng, 
                ST_Y(s.coords::geometry) as lat
            FROM flood_logs l
            JOIN sensors s ON l.sensor_id = s.sensor_id
            WHERE s.is_active = TRUE
            ORDER BY l.sensor_id, l.created_at DESC
        `);
        return result.rows;
    }
};

module.exports = floodModel;

