const BaseRepository = require('./baseRepository');

/**
 * Flood Repository
 * Chứa tất cả các query liên quan đến flood_logs
 */
class FloodRepository extends BaseRepository {
    /**
     * Lấy tất cả dữ liệu ngập lụt (API cũ - giữ để tương thích)
     */
    async getAllFloodLogs() {
        const query = `
            SELECT 
                id,
                sensor_id,
                raw_distance,
                water_level,
                velocity,
                status,
                created_at
            FROM flood_logs
            ORDER BY created_at DESC
        `;
        return await this.queryAll(query);
    }

    /**
     * Lấy dữ liệu ngập lụt kèm thông tin sensor (join với bảng sensors)
     * Trả về bản ghi mới nhất cho mỗi sensor
     */
    async getFloodDataWithSensors() {
        const query = `
            SELECT DISTINCT ON (s.sensor_id)
                s.sensor_id,
                s.location_name,
                s.model,
                s.status as sensor_status,
                l.water_level,
                l.velocity,
                l.status as log_status,
                l.created_at,
                ST_X(s.coords::geometry) as lng,
                ST_Y(s.coords::geometry) as lat,
                t.warning_threshold,
                t.danger_threshold,
                s.last_data_time
            FROM sensors s
            LEFT JOIN flood_logs l ON s.sensor_id = l.sensor_id
            LEFT JOIN sensor_thresholds t ON s.sensor_id = t.sensor_id
            WHERE s.is_active = TRUE
            ORDER BY s.sensor_id, l.created_at DESC NULLS LAST
        `;
        return await this.queryAll(query);
    }

    /**
     * Lấy dữ liệu real-time với đầy đủ trạng thái (KHUYẾN NGHỊ cho Frontend)
     */
    async getRealTimeFloodData() {
        const query = `
            SELECT DISTINCT ON (s.sensor_id)
                s.sensor_id,
                s.location_name,
                s.model,
                s.status as sensor_status,
                l.water_level,
                l.velocity,
                l.status as log_status,
                l.created_at,
                ST_X(s.coords::geometry) as lng,
                ST_Y(s.coords::geometry) as lat,
                t.warning_threshold,
                t.danger_threshold,
                s.last_data_time
            FROM sensors s
            LEFT JOIN flood_logs l ON s.sensor_id = l.sensor_id
            LEFT JOIN sensor_thresholds t ON s.sensor_id = t.sensor_id
            WHERE s.is_active = TRUE
            ORDER BY s.sensor_id, l.created_at DESC NULLS LAST
        `;
        return await this.queryAll(query);
    }

    /**
     * Lấy lịch sử dữ liệu cho một sensor cụ thể
     * @param {string} sensorId - ID của sensor
     * @param {number} limit - Số lượng bản ghi tối đa
     */
    async getFloodHistoryBySensor(sensorId, limit = 100) {
        const query = `
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
        `;
        return await this.queryAll(query, [sensorId, limit]);
    }

    /**
     * Tạo flood log mới
     * @param {Object} floodData - Dữ liệu flood log
     */
    async createFloodLog(floodData) {
        const {
            sensor_id,
            raw_distance,
            water_level,
            velocity,
            status
        } = floodData;

        const query = `
            INSERT INTO flood_logs (sensor_id, raw_distance, water_level, velocity, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        return await this.queryOne(query, [sensor_id, raw_distance, water_level, velocity, status]);
    }

    /**
     * Lấy flood log mới nhất của một sensor
     * @param {string} sensorId - ID của sensor
     */
    async getLatestFloodLog(sensorId) {
        const query = `
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
            LIMIT 1
        `;
        return await this.queryOne(query, [sensorId]);
    }

    /**
     * Lấy dữ liệu gần nhất trong khoảng thời gian để tính vận tốc
     * @param {string} sensorId - ID của sensor
     * @param {number} minMinutes - Số phút tối thiểu trước đó
     * @param {number} maxMinutes - Số phút tối đa trước đó
     * @param {number} targetMinutes - Số phút mục tiêu (để tìm gần nhất)
     */
    async getFloodLogForVelocity(sensorId, minMinutes = 4, maxMinutes = 6, targetMinutes = 5) {
        // Đảm bảo các giá trị là số nguyên hợp lệ để tránh SQL injection
        const minMins = parseInt(minMinutes, 10);
        const maxMins = parseInt(maxMinutes, 10);
        const targetMins = parseFloat(targetMinutes);
        
        const query = `
            SELECT water_level, created_at,
                   ABS(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 - $1) as time_diff
            FROM flood_logs 
            WHERE sensor_id = $2 
            AND created_at >= NOW() - INTERVAL '${maxMins} minutes'
            AND created_at <= NOW() - INTERVAL '${minMins} minutes'
            ORDER BY ABS(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 - $1)
            LIMIT 1
        `;
        return await this.queryOne(query, [targetMins, sensorId]);
    }

    /**
     * Lấy dữ liệu heatmap - phân bố mực nước theo khu vực
     * @param {Object} bounds - {minLng, minLat, maxLng, maxLat}
     * @param {number} gridSize - Kích thước lưới (mét)
     */
    async getHeatmapData(bounds = null, gridSize = 500) {
        let query = `
            WITH grid AS (
                SELECT 
                    ST_SnapToGrid(
                        ST_SetSRID(ST_MakePoint(
                            FLOOR(ST_X(s.coords::geometry) * 1000) / 1000.0,
                            FLOOR(ST_Y(s.coords::geometry) * 1000) / 1000.0
                        ), 4326)::geography,
                        $1
                    ) as grid_point,
                    AVG(l.water_level) as avg_water_level,
                    MAX(l.water_level) as max_water_level,
                    COUNT(*) as data_count,
                    MAX(l.status) as max_status
                FROM sensors s
                LEFT JOIN LATERAL (
                    SELECT water_level, status
                    FROM flood_logs
                    WHERE sensor_id = s.sensor_id
                    AND created_at >= NOW() - INTERVAL '1 hour'
                    ORDER BY created_at DESC
                    LIMIT 1
                ) l ON true
                WHERE s.is_active = TRUE
        `;
        const params = [gridSize];
        let paramIndex = 2;

        if (bounds) {
            query += ` AND ST_X(s.coords::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}
                      AND ST_Y(s.coords::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}`;
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
        }

        query += `
                GROUP BY grid_point
            )
            SELECT 
                ST_X(grid_point::geometry) as lng,
                ST_Y(grid_point::geometry) as lat,
                COALESCE(avg_water_level, 0) as intensity,
                COALESCE(max_water_level, 0) as max_intensity,
                data_count,
                max_status
            FROM grid
            WHERE avg_water_level IS NOT NULL
            ORDER BY avg_water_level DESC
        `;

        return await this.queryAll(query, params);
    }

    /**
     * Lấy dữ liệu heatmap kết hợp với crowd reports
     * @param {Object} bounds - {minLng, minLat, maxLng, maxLat}
     */
    async getCombinedHeatmapData(bounds = null) {
        let query = `
            WITH sensor_data AS (
                SELECT 
                    ST_X(s.coords::geometry) as lng,
                    ST_Y(s.coords::geometry) as lat,
                    l.water_level,
                    l.status,
                    'sensor' as source
                FROM sensors s
                LEFT JOIN LATERAL (
                    SELECT water_level, status
                    FROM flood_logs
                    WHERE sensor_id = s.sensor_id
                    AND created_at >= NOW() - INTERVAL '1 hour'
                    ORDER BY created_at DESC
                    LIMIT 1
                ) l ON true
                WHERE s.is_active = TRUE
        `;
        const params = [];
        let paramIndex = 1;

        if (bounds) {
            query += ` AND ST_X(s.coords::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}
                      AND ST_Y(s.coords::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}`;
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
        }

        query += `
            ),
            report_data AS (
                SELECT 
                    ST_X(location::geometry) as lng,
                    ST_Y(location::geometry) as lat,
                    CASE flood_level
                        WHEN 'Nhẹ' THEN 10
                        WHEN 'Trung bình' THEN 30
                        WHEN 'Nặng' THEN 50
                        ELSE 0
                    END as water_level,
                    'normal' as status,
                    'crowd' as source
                FROM crowd_reports
                WHERE created_at >= NOW() - INTERVAL '24 hours'
                AND moderation_status = 'approved'
        `;

        if (bounds) {
            query += ` AND ST_X(location::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}
                      AND ST_Y(location::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}`;
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
        }

        query += `
            )
            SELECT * FROM sensor_data
            UNION ALL
            SELECT * FROM report_data
            ORDER BY water_level DESC
        `;

        return await this.queryAll(query, params);
    }
}

module.exports = new FloodRepository();

