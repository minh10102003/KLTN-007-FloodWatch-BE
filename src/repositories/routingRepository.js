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

    async getActiveEdgesWithFloodDepth() {
        return this.queryAll(
            `
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
                    lf.water_level,
                    0
                ) AS flood_depth_cm
            FROM road_edges e
            INNER JOIN road_nodes fn ON fn.id = e.from_node_id
            INNER JOIN road_nodes tn ON tn.id = e.to_node_id
            LEFT JOIN LATERAL (
                SELECT fl.water_level
                FROM flood_logs fl
                WHERE fl.sensor_id = e.flood_sensor_id
                ORDER BY fl.created_at DESC
                LIMIT 1
            ) lf ON true
            WHERE e.is_active = TRUE
            `
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
