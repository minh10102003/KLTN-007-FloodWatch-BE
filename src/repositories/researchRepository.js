const BaseRepository = require('./baseRepository');
const { sqlFloodLevelToCm } = require('../utils/floodLevelMapper');

class ResearchRepository extends BaseRepository {
    _boundsClause(columnSql, paramStartIndex) {
        return ` AND ST_X(${columnSql}) BETWEEN $${paramStartIndex} AND $${paramStartIndex + 1}
                AND ST_Y(${columnSql}) BETWEEN $${paramStartIndex + 2} AND $${paramStartIndex + 3}`;
    }

    _validBounds(b) {
        const n = ['minLng', 'maxLng', 'minLat', 'maxLat'];
        return n.every((k) => b[k] != null && Number.isFinite(Number(b[k])));
    }

    /**
     * Cảm biến active có ít nhất một flood_log trong cửa sổ (cùng logic D1 / evaluation).
     */
    _sensorLatestCte(paramSensorHours) {
        return `
            sensor_latest AS (
                SELECT DISTINCT ON (s.sensor_id)
                    s.sensor_id,
                    s.coords,
                    s.location_name
                FROM sensors s
                INNER JOIN flood_logs l ON l.sensor_id = s.sensor_id
                    AND l.created_at >= NOW() - make_interval(hours => $${paramSensorHours}::int)
                WHERE s.is_active = TRUE
                ORDER BY s.sensor_id, l.created_at DESC
            )`;
    }

    _reportBaseCte({ reportHoursParam, bounds, boundsStartIndex }) {
        let sql = `
            report_base AS (
                SELECT
                    cr.id,
                    cr.created_at,
                    cr.location,
                    ST_X(cr.location::geometry) AS lng,
                    ST_Y(cr.location::geometry) AS lat,
                    ${sqlFloodLevelToCm('cr.flood_level')} AS crowd_cm
                FROM crowd_reports cr
                WHERE cr.moderation_status = 'approved'
                  AND cr.created_at >= NOW() - make_interval(hours => $${reportHoursParam}::int)
        `;
        if (bounds && this._validBounds(bounds)) {
            sql += this._boundsClause('cr.location::geometry', boundsStartIndex);
        }
        sql += `
            )`;
        return sql;
    }

    _reportWithNearestCte(nearestFromTable = 'sensor_latest') {
        return `
            report_with_nearest AS (
                SELECT
                    rb.*,
                    ns.sensor_id AS nearest_sensor_id,
                    ns.dist_m AS nearest_sensor_dist_m
                FROM report_base rb
                LEFT JOIN LATERAL (
                    SELECT
                        sl.sensor_id,
                        ST_Distance(rb.location::geography, sl.coords::geography) AS dist_m
                    FROM ${nearestFromTable} sl
                    ORDER BY rb.location::geography <-> sl.coords
                    LIMIT 1
                ) ns ON TRUE
            )`;
    }

    /**
     * D2 — điểm nóng: nhiều báo cáo approved nhưng xa mọi sensor có dữ liệu gần đây.
     */
    async getColdStartHotspots({
        hours = 72,
        sensorHours = 6,
        radiusM = 1500,
        minReports = 2,
        bounds = null
    }) {
        const params = [hours, sensorHours, radiusM, minReports];
        let paramIndex = 5;
        let query = `
            WITH ${this._sensorLatestCte(2)},
            ${this._reportBaseCte({ reportHoursParam: 1, bounds, boundsStartIndex: paramIndex })}
        `;
        if (bounds && this._validBounds(bounds)) {
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
            paramIndex += 4;
        }
        query += `,${this._reportWithNearestCte('sensor_latest')}
            SELECT
                ROUND(lng::numeric, 3) AS hotspot_lng,
                ROUND(lat::numeric, 3) AS hotspot_lat,
                COUNT(*)::int AS report_count,
                ROUND(AVG(crowd_cm)::numeric, 2) AS avg_crowd_cm,
                ROUND(MAX(crowd_cm)::numeric, 2) AS max_crowd_cm,
                ROUND(MIN(nearest_sensor_dist_m)::numeric, 1) AS nearest_sensor_min_dist_m,
                MAX(created_at) AS latest_report_at
            FROM report_with_nearest
            WHERE nearest_sensor_dist_m IS NULL OR nearest_sensor_dist_m > $3::float
            GROUP BY ROUND(lng::numeric, 3), ROUND(lat::numeric, 3)
            HAVING COUNT(*) >= $4::int
            ORDER BY report_count DESC, avg_crowd_cm DESC, latest_report_at DESC
        `;
        return await this.queryAll(query, params);
    }

    /**
     * Debug D2 — phân bố khoảng cách tới sensor có log trong sensor_hours.
     */
    async getColdStartDistanceDebug({ hours = 72, sensorHours = 6, radiusM = 1500, bounds = null }) {
        const params = [hours, sensorHours, radiusM];
        let paramIndex = 4;
        let query = `
            WITH ${this._sensorLatestCte(2)},
            ${this._reportBaseCte({ reportHoursParam: 1, bounds, boundsStartIndex: paramIndex })}
        `;
        if (bounds && this._validBounds(bounds)) {
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
            paramIndex += 4;
        }
        query += `,${this._reportWithNearestCte('sensor_latest')},
            sensor_count AS (
                SELECT COUNT(*)::int AS sensors_with_logs FROM sensor_latest
            ),
            dist_rows AS (
                SELECT nearest_sensor_dist_m FROM report_with_nearest
            )
            SELECT
                (SELECT sensors_with_logs FROM sensor_count) AS sensors_with_logs_in_window,
                (SELECT COUNT(*)::int FROM report_base) AS approved_reports_in_window,
                (SELECT COUNT(*)::int FROM dist_rows WHERE nearest_sensor_dist_m IS NULL) AS reports_no_sensor_with_logs,
                (SELECT COUNT(*)::int FROM dist_rows WHERE nearest_sensor_dist_m > $3::float) AS reports_beyond_radius,
                (
                    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
                    FROM (
                        SELECT
                            bucket_label,
                            bucket_order,
                            COUNT(*)::int AS report_count
                        FROM (
                            SELECT
                                CASE
                                    WHEN nearest_sensor_dist_m IS NULL THEN 'no_sensor_with_logs'
                                    WHEN nearest_sensor_dist_m <= 500 THEN '0-500m'
                                    WHEN nearest_sensor_dist_m <= 1500 THEN '500-1500m'
                                    WHEN nearest_sensor_dist_m <= 5000 THEN '1500-5000m'
                                    WHEN nearest_sensor_dist_m <= 10000 THEN '5000-10000m'
                                    ELSE '10000m+'
                                END AS bucket_label,
                                CASE
                                    WHEN nearest_sensor_dist_m IS NULL THEN 0
                                    WHEN nearest_sensor_dist_m <= 500 THEN 1
                                    WHEN nearest_sensor_dist_m <= 1500 THEN 2
                                    WHEN nearest_sensor_dist_m <= 5000 THEN 3
                                    WHEN nearest_sensor_dist_m <= 10000 THEN 4
                                    ELSE 5
                                END AS bucket_order
                            FROM dist_rows
                        ) b
                        GROUP BY bucket_label, bucket_order
                        ORDER BY bucket_order
                    ) t
                ) AS distance_histogram
        `;
        const row = await this.queryOne(query, params);
        return row || {
            sensors_with_logs_in_window: 0,
            approved_reports_in_window: 0,
            reports_no_sensor_with_logs: 0,
            reports_beyond_radius: 0,
            distance_histogram: []
        };
    }
}

module.exports = new ResearchRepository();
