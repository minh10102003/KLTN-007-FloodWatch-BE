const BaseRepository = require('./baseRepository');

/**
 * Truy vấn nguồn dữ liệu cho fusion cảm biến + crowdsourcing (PostGIS).
 */
class FusionRepository extends BaseRepository {
    _boundsClause(columnSql, paramStartIndex) {
        return ` AND ST_X(${columnSql}) BETWEEN $${paramStartIndex} AND $${paramStartIndex + 1}
                AND ST_Y(${columnSql}) BETWEEN $${paramStartIndex + 2} AND $${paramStartIndex + 3}`;
    }

    /**
     * Cảm biến active + bản ghi flood_logs mới nhất trong cửa sổ giờ (có thể null nếu không có log).
     * @param {number} sensorHours
     * @param {{ minLng, maxLng, minLat, maxLat }|null} bounds
     */
    async getSensorLatestInWindow(sensorHours, bounds = null) {
        let query = `
            SELECT DISTINCT ON (s.sensor_id)
                s.sensor_id,
                s.location_name,
                l.water_level AS water_level_cm,
                l.status AS log_status,
                ST_X(s.coords::geometry) AS lng,
                ST_Y(s.coords::geometry) AS lat,
                l.created_at AS log_created_at
            FROM sensors s
            LEFT JOIN flood_logs l ON s.sensor_id = l.sensor_id
                AND l.created_at >= NOW() - make_interval(hours => $1::int)
            WHERE s.is_active = TRUE
        `;
        const params = [sensorHours];
        if (bounds && this._validBounds(bounds)) {
            query += this._boundsClause('s.coords::geometry', 2);
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
        }
        query += `
            ORDER BY s.sensor_id, l.created_at DESC NULLS LAST
        `;
        return await this.queryAll(query, params);
    }

    /**
     * Báo cáo đã duyệt + cảm biến gần nhất (đọc gần đây) và khoảng cách (m).
     */
    async getCrowdReportsWithNearestSensor(crowdHours, sensorHours, bounds = null) {
        let query = `
            WITH sensor_latest AS (
                SELECT DISTINCT ON (s.sensor_id)
                    s.sensor_id,
                    s.coords,
                    l.water_level AS sensor_water_cm
                FROM sensors s
                INNER JOIN flood_logs l ON l.sensor_id = s.sensor_id
                WHERE s.is_active = TRUE
                    AND l.created_at >= NOW() - make_interval(hours => $2::int)
                ORDER BY s.sensor_id, l.created_at DESC
            ),
            reports AS (
                SELECT
                    cr.id,
                    cr.flood_level,
                    COALESCE(cr.reliability_score, 50)::float AS reliability_score,
                    cr.created_at,
                    cr.location,
                    ST_X(cr.location::geometry) AS lng,
                    ST_Y(cr.location::geometry) AS lat,
                    CASE cr.flood_level
                        WHEN 'Nhẹ' THEN 10.0
                        WHEN 'Trung bình' THEN 30.0
                        WHEN 'Nặng' THEN 50.0
                        ELSE 0.0
                    END AS crowd_cm
                FROM crowd_reports cr
                WHERE cr.moderation_status = 'approved'
                    AND cr.created_at >= NOW() - make_interval(hours => $1::int)
        `;
        const params = [crowdHours, sensorHours];
        if (bounds && this._validBounds(bounds)) {
            query += this._boundsClause('cr.location::geometry', 3);
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
        }
        query += `
            )
            SELECT
                r.id,
                r.flood_level,
                r.reliability_score,
                r.created_at,
                r.lng,
                r.lat,
                r.crowd_cm,
                ns.sensor_id AS nearest_sensor_id,
                ns.sensor_water_cm AS nearest_sensor_cm,
                ns.dist_m AS nearest_sensor_dist_m
            FROM reports r
            LEFT JOIN LATERAL (
                SELECT
                    sl.sensor_id,
                    sl.sensor_water_cm,
                    ST_Distance(r.location::geography, sl.coords::geography) AS dist_m
                FROM sensor_latest sl
                ORDER BY r.location::geography <-> sl.coords
                LIMIT 1
            ) ns ON TRUE
            ORDER BY r.created_at DESC
        `;
        return await this.queryAll(query, params);
    }

    _validBounds(b) {
        const n = ['minLng', 'maxLng', 'minLat', 'maxLat'];
        return n.every((k) => b[k] != null && Number.isFinite(Number(b[k])));
    }
}

module.exports = new FusionRepository();
