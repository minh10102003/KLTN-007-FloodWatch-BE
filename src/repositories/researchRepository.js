const BaseRepository = require('./baseRepository');

class ResearchRepository extends BaseRepository {
    _boundsClause(columnSql, paramStartIndex) {
        return ` AND ST_X(${columnSql}) BETWEEN $${paramStartIndex} AND $${paramStartIndex + 1}
                AND ST_Y(${columnSql}) BETWEEN $${paramStartIndex + 2} AND $${paramStartIndex + 3}`;
    }

    _validBounds(b) {
        const n = ['minLng', 'maxLng', 'minLat', 'maxLat'];
        return n.every((k) => b[k] != null && Number.isFinite(Number(b[k])));
    }

    async getColdStartHotspots({ hours = 72, radiusM = 1500, minReports = 2, bounds = null }) {
        let query = `
            WITH report_base AS (
                SELECT
                    cr.id,
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
        const params = [hours, radiusM, minReports];
        let paramIndex = 4;
        if (bounds && this._validBounds(bounds)) {
            query += this._boundsClause('cr.location::geometry', paramIndex);
            params.push(bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat);
        }
        query += `
            ),
            report_with_nearest AS (
                SELECT
                    rb.*,
                    ns.dist_m AS nearest_sensor_dist_m
                FROM report_base rb
                LEFT JOIN LATERAL (
                    SELECT ST_Distance(rb.location::geography, s.coords::geography) AS dist_m
                    FROM sensors s
                    WHERE s.is_active = TRUE
                    ORDER BY rb.location::geography <-> s.coords
                    LIMIT 1
                ) ns ON TRUE
            )
            SELECT
                ROUND(lng::numeric, 3) AS hotspot_lng,
                ROUND(lat::numeric, 3) AS hotspot_lat,
                COUNT(*)::int AS report_count,
                ROUND(AVG(crowd_cm)::numeric, 2) AS avg_crowd_cm,
                ROUND(MAX(crowd_cm)::numeric, 2) AS max_crowd_cm,
                ROUND(MIN(nearest_sensor_dist_m)::numeric, 1) AS nearest_sensor_min_dist_m,
                MAX(created_at) AS latest_report_at
            FROM report_with_nearest
            WHERE nearest_sensor_dist_m IS NULL OR nearest_sensor_dist_m > $2::float
            GROUP BY ROUND(lng::numeric, 3), ROUND(lat::numeric, 3)
            HAVING COUNT(*) >= $3::int
            ORDER BY report_count DESC, avg_crowd_cm DESC, latest_report_at DESC
        `;
        return await this.queryAll(query, params);
    }
}

module.exports = new ResearchRepository();
