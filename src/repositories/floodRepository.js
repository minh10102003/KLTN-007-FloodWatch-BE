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
                temperature,
                humidity,
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
                l.temperature,
                l.humidity,
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
                l.temperature,
                l.humidity,
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
                temperature,
                humidity,
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
            status,
            temperature,
            humidity,
            ingest_key
        } = floodData;

        if (!ingest_key || String(ingest_key).trim() === '') {
            throw new Error('createFloodLog cần ingest_key (idempotent MQTT)');
        }

        const query = `
            INSERT INTO flood_logs (sensor_id, raw_distance, water_level, velocity, status, temperature, humidity, ingest_key)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (sensor_id, ingest_key) DO NOTHING
            RETURNING *
        `;
        const rows = await this.query(query, [
            sensor_id,
            raw_distance,
            water_level,
            velocity,
            status,
            temperature != null ? parseFloat(temperature) : null,
            humidity != null ? parseFloat(humidity) : null,
            String(ingest_key).slice(0, 64)
        ]);
        return rows[0] || null;
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
                temperature,
                humidity,
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
        const gridM = Math.min(5000, Math.max(50, Number(gridSize) || 500));
        let query = `
            WITH grid AS (
                SELECT
                    ST_SnapToGrid(
                        ST_Transform(s.coords::geometry, 3857),
                        $1::double precision
                    ) AS grid_geom_3857,
                    AVG(l.water_level) AS avg_water_level,
                    MAX(l.water_level) AS max_water_level,
                    COUNT(*)::int AS data_count,
                    MAX(l.status) AS max_status
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
        const params = [gridM];
        let paramIndex = 2;

        if (bounds) {
            query += ` AND ST_X(s.coords::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}
                      AND ST_Y(s.coords::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}`;
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
        }

        query += `
                GROUP BY grid_geom_3857
            )
            SELECT
                ST_X(ST_Transform(grid_geom_3857, 4326)) AS lng,
                ST_Y(ST_Transform(grid_geom_3857, 4326)) AS lat,
                COALESCE(avg_water_level, 0) AS intensity,
                COALESCE(max_water_level, 0) AS max_intensity,
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

    /**
     * Timeline 24h cho heatmap (theo giờ), gộp sensor + crowd đã duyệt.
     * @param {Object|null} bounds - { minLng, minLat, maxLng, maxLat }
     */
    async getHeatmapTimeline24h(bounds = null) {
        let query = `
            WITH hours AS (
                SELECT generate_series(
                    date_trunc('hour', NOW()) - INTERVAL '23 hour',
                    date_trunc('hour', NOW()),
                    INTERVAL '1 hour'
                ) AS bucket
            ),
            sensor_agg AS (
                SELECT
                    date_trunc('hour', fl.created_at) AS bucket,
                    AVG(fl.water_level) AS sensor_avg_water_level,
                    COUNT(*)::int AS sensor_points
                FROM flood_logs fl
                INNER JOIN sensors s ON s.sensor_id = fl.sensor_id
                WHERE fl.created_at >= NOW() - INTERVAL '24 hour'
                  AND s.is_active = TRUE
        `;
        const params = [];
        let paramIndex = 1;

        if (bounds) {
            query += `
                  AND ST_X(s.coords::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}
                  AND ST_Y(s.coords::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}
            `;
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
        }

        query += `
                GROUP BY 1
            ),
            crowd_agg AS (
                SELECT
                    date_trunc('hour', cr.created_at) AS bucket,
                    AVG(
                        CASE cr.flood_level
                            WHEN 'Nhẹ' THEN 10
                            WHEN 'Trung bình' THEN 30
                            WHEN 'Nặng' THEN 50
                            ELSE 0
                        END
                    ) AS crowd_avg_water_level,
                    COUNT(*)::int AS crowd_points
                FROM crowd_reports cr
                WHERE cr.created_at >= NOW() - INTERVAL '24 hour'
                  AND cr.moderation_status = 'approved'
        `;

        if (bounds) {
            query += `
                  AND ST_X(cr.location::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}
                  AND ST_Y(cr.location::geometry) BETWEEN $${paramIndex++} AND $${paramIndex++}
            `;
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
        }

        query += `
                GROUP BY 1
            )
            SELECT
                h.bucket AS bucket_time,
                sa.sensor_avg_water_level,
                sa.sensor_points,
                ca.crowd_avg_water_level,
                ca.crowd_points,
                (
                    COALESCE(sa.sensor_points, 0) + COALESCE(ca.crowd_points, 0)
                )::int AS total_points
            FROM hours h
            LEFT JOIN sensor_agg sa ON sa.bucket = h.bucket
            LEFT JOIN crowd_agg ca ON ca.bucket = h.bucket
            ORDER BY h.bucket ASC
        `;

        return await this.queryAll(query, params);
    }

    /**
     * Chuỗi flood_logs trong cửa sổ thời gian (ASC) — phục vụ dự báo xu hướng.
     * @param {string} sensorId
     * @param {number} minutesBack - tối đa 24h (giới hạn trong controller)
     */
    async getFloodLogsForForecast(sensorId, minutesBack) {
        const mins = Math.max(1, Math.min(parseInt(minutesBack, 10) || 90, 24 * 60));
        const query = `
            SELECT water_level, created_at
            FROM flood_logs
            WHERE sensor_id = $1
              AND created_at >= NOW() - ($2::int * INTERVAL '1 minute')
            ORDER BY created_at ASC
        `;
        return await this.queryAll(query, [sensorId, mins]);
    }
}

module.exports = new FloodRepository();

