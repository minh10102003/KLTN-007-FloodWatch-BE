const BaseRepository = require('./baseRepository');

class RoutingRepository extends BaseRepository {
    async getNearestNode({ lng, lat, maxDistanceMeters = 1500 }) {
        return this.queryOne(
            `
            SELECT
                id,
                ST_X(location::geometry) AS lng,
                ST_Y(location::geometry) AS lat,
                ST_Distance(
                    location,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) AS distance_m
            FROM road_nodes
            WHERE ST_DWithin(
                location,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
            )
            ORDER BY distance_m ASC
            LIMIT 1
            `,
            [lng, lat, maxDistanceMeters]
        );
    }

    async getActiveEdgesWithFloodDepth({
        crowdHours = 6,
        crowdBufferM = 35,
        crowdHalfLifeHours = 2,
        crowdMinReliability = 40,
        crowdMaxBoost = 2,
        sensorFloodRadiusM = 120,
        sensorFloodDecay = 'linear'
    } = {}) {
        const decay = String(sensorFloodDecay || 'linear').trim().toLowerCase() === 'plateau' ? 'plateau' : 'linear';
        return this.queryAll(
            `
            WITH crowd_recent AS (
                SELECT
                    location,
                    reliability_score,
                    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 AS age_hours,
                    CASE
                        WHEN LOWER(TRIM(flood_level)) IN ('nhẹ', 'nhe', 'light', 'mild') THEN 12
                        WHEN LOWER(TRIM(flood_level)) IN ('trung bình', 'trung binh', 'medium', 'moderate') THEN 25
                        WHEN LOWER(TRIM(flood_level)) IN ('nặng', 'nang', 'heavy', 'severe') THEN 45
                        ELSE NULL
                    END AS flood_cm
                FROM crowd_reports
                WHERE moderation_status = 'approved'
                  AND COALESCE(reliability_score, 50) >= $4
                  AND created_at >= NOW() - ($1::int * INTERVAL '1 hour')
            ),
            crowd_weighted AS (
                SELECT
                    location,
                    flood_cm,
                    LEAST(
                        500.0,
                        flood_cm
                        * EXP(-(LN(2) * age_hours / GREATEST($3::double precision, 0.25)))
                        * (0.6 + LEAST(100, GREATEST(0, COALESCE(reliability_score, 50))) / 100.0)
                        * GREATEST($5::double precision, 1.0)
                    ) AS weighted_flood_cm
                FROM crowd_recent
                WHERE flood_cm IS NOT NULL
            ),
            crowd_edge AS (
                SELECT
                    e.id AS edge_id,
                    MAX(cw.weighted_flood_cm) AS crowd_flood_cm
                FROM road_edges e
                INNER JOIN crowd_weighted cw
                    ON ST_DWithin(e.geom, cw.location, $2)
                WHERE e.is_active = TRUE
                GROUP BY e.id
            )
            SELECT
                e.id,
                e.from_node_id,
                e.to_node_id,
                e.length_m,
                e.speed_limit_mps,
                e.is_bidirectional,
                ST_X(fn.location::geometry) AS from_lng,
                ST_Y(fn.location::geometry) AS from_lat,
                ST_X(tn.location::geometry) AS to_lng,
                ST_Y(tn.location::geometry) AS to_lat,
                COALESCE(
                    e.manual_flood_depth_cm,
                    GREATEST(
                        COALESCE(
                            CASE
                                WHEN sens.status = 'offline' OR sens.is_active = FALSE THEN 0::double precision
                                WHEN sl.raw_wl IS NULL THEN 0::double precision
                                WHEN sens.coords IS NULL THEN sl.raw_wl::double precision
                                WHEN sl.dist_m IS NULL THEN sl.raw_wl::double precision
                                WHEN sl.dist_m >= $6::double precision THEN 0::double precision
                                WHEN $7::text = 'plateau' THEN sl.raw_wl::double precision
                                ELSE GREATEST(
                                    0::double precision,
                                    sl.raw_wl::double precision
                                        * (1.0 - sl.dist_m / NULLIF($6::double precision, 0))
                                )
                            END,
                            0::double precision
                        ),
                        COALESCE(ce.crowd_flood_cm, 0)
                    ),
                    0
                ) AS flood_depth_cm
            FROM road_edges e
            INNER JOIN road_nodes fn ON fn.id = e.from_node_id
            INNER JOIN road_nodes tn ON tn.id = e.to_node_id
            LEFT JOIN sensors sens ON sens.sensor_id = e.flood_sensor_id
            LEFT JOIN LATERAL (
                SELECT
                    fl.water_level AS raw_wl,
                    CASE
                        WHEN sens.coords IS NULL THEN NULL::double precision
                        ELSE ST_Distance(e.geom, sens.coords)
                    END AS dist_m
                FROM flood_logs fl
                WHERE fl.sensor_id = e.flood_sensor_id
                ORDER BY fl.created_at DESC
                LIMIT 1
            ) sl ON true
            LEFT JOIN crowd_edge ce ON ce.edge_id = e.id
            WHERE e.is_active = TRUE
            `,
            [crowdHours, crowdBufferM, crowdHalfLifeHours, crowdMinReliability, crowdMaxBoost, sensorFloodRadiusM, decay]
        );
    }

    async updateManualFloodDepthBatch(updates) {
        if (!Array.isArray(updates) || updates.length === 0) {
            return [];
        }

        const valuesSql = [];
        const params = [];
        let p = 1;
        for (const row of updates) {
            valuesSql.push(`($${p++}::bigint, $${p++}::double precision)`);
            params.push(Number(row.edge_id), row.manual_flood_depth_cm == null ? null : Number(row.manual_flood_depth_cm));
        }

        return this.queryAll(
            `
            WITH data(edge_id, depth_cm) AS (
                VALUES ${valuesSql.join(', ')}
            )
            UPDATE road_edges e
            SET manual_flood_depth_cm = data.depth_cm
            FROM data
            WHERE e.id = data.edge_id
            RETURNING e.id, e.manual_flood_depth_cm, e.flood_sensor_id, e.is_active
            `,
            params
        );
    }
}

module.exports = new RoutingRepository();
