/**
 * Map road_edges.flood_sensor_id theo sensor active gần nhất (phương án 1 — thu hẹp gắn sensor).
 *
 * Chỉ gán khi khoảng cách centroid(cạnh) → sensor <= maxDistanceM. Nên để maxDistance ~ cùng bậc với
 * ROUTING_SENSOR_FLOOD_RADIUS_M (routing) để không gắn cả tuyến dài vào một trạm rồi mới “giảm” bằng code.
 *
 * Thứ tự ưu tiên khoảng cách mặc định:
 *   1) CLI --max-distance-m
 *   2) env ROUTING_EDGE_SENSOR_MAX_DISTANCE_M
 *   3) env ROUTING_SENSOR_FLOOD_RADIUS_M * 1.25 (làm tròn, clamp 50..400)
 *   4) 150 (m)
 *
 * Usage:
 *   npm run map:road-sensors
 *   node scripts/mapRoadEdgesToSensors.js --max-distance-m 200 --clear-out-of-range
 */
const { Pool } = require('pg');
require('dotenv').config();

const MAP_DISTANCE_MIN_M = 50;
const MAP_DISTANCE_MAX_M = 20000;

function resolveDefaultMapMaxDistanceM() {
    const edgeEnv = process.env.ROUTING_EDGE_SENSOR_MAX_DISTANCE_M;
    if (edgeEnv != null && String(edgeEnv).trim() !== '') {
        const n = Number(edgeEnv);
        if (Number.isFinite(n) && n > 0) return n;
    }
    const r = parseInt(process.env.ROUTING_SENSOR_FLOOD_RADIUS_M || '120', 10);
    if (Number.isFinite(r) && r > 0) {
        return Math.min(400, Math.max(50, Math.round(r * 1.25)));
    }
    return 150;
}

function parseArgs(argv) {
    const out = {
        maxDistanceM: resolveDefaultMapMaxDistanceM(),
        clearOutOfRange: false
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--max-distance-m') out.maxDistanceM = Number(argv[++i]) || out.maxDistanceM;
        else if (a === '--clear-out-of-range') out.clearOutOfRange = true;
    }
    out.maxDistanceM = Math.min(MAP_DISTANCE_MAX_M, Math.max(MAP_DISTANCE_MIN_M, out.maxDistanceM));
    return out;
}

function isValidPostgresUrl(str) {
    if (!str || typeof str !== 'string') return false;
    try {
        new URL(str.trim().replace(/^postgresql:/i, 'postgres:'));
        return true;
    } catch {
        return false;
    }
}

function shouldUseSsl(connectionString) {
    if (process.env.DB_SSL === 'false') return false;
    if ((process.env.PGSSLMODE || '').toLowerCase() === 'disable') return false;
    if (connectionString) {
        try {
            const u = new URL(connectionString.replace(/^postgresql:/i, 'postgres:'));
            if ((u.searchParams.get('sslmode') || '').toLowerCase() === 'disable') return false;
        } catch {
            /* ignore */
        }
    }
    return true;
}

function buildPool() {
    const rawUrl = process.env.DATABASE_URL?.trim();
    if (rawUrl && isValidPostgresUrl(rawUrl)) {
        const ssl = shouldUseSsl(rawUrl);
        return new Pool({
            connectionString: rawUrl,
            ...(ssl ? { ssl: { rejectUnauthorized: false } } : {})
        });
    }
    return new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASS,
        port: process.env.DB_PORT
    });
}

async function run() {
    const args = parseArgs(process.argv);
    const pool = buildPool();
    const client = await pool.connect();
    try {
        console.log(
            `ℹ️  Mapping flood_sensor_id (nearest active sensor, centroid→sensor) maxDistance=${args.maxDistanceM}m ...`
        );
        await client.query('BEGIN');

        const mapped = await client.query(
            `
            WITH nearest AS (
                SELECT
                    e.id AS edge_id,
                    s.sensor_id,
                    ST_Distance(
                        ST_Centroid(e.geom::geometry)::geography,
                        s.coords
                    ) AS distance_m,
                    ROW_NUMBER() OVER (
                        PARTITION BY e.id
                        ORDER BY ST_Distance(ST_Centroid(e.geom::geometry)::geography, s.coords)
                    ) AS rn
                FROM road_edges e
                JOIN sensors s ON s.is_active = TRUE
                WHERE e.is_active = TRUE
            ),
            picked AS (
                SELECT edge_id, sensor_id, distance_m
                FROM nearest
                WHERE rn = 1 AND distance_m <= $1
            )
            UPDATE road_edges e
            SET flood_sensor_id = p.sensor_id
            FROM picked p
            WHERE e.id = p.edge_id
            RETURNING e.id
            `,
            [args.maxDistanceM]
        );

        let cleared = { rowCount: 0 };
        if (args.clearOutOfRange) {
            cleared = await client.query(
                `
                UPDATE road_edges e
                SET flood_sensor_id = NULL
                WHERE e.is_active = TRUE
                  AND NOT EXISTS (
                      SELECT 1
                      FROM sensors s
                      WHERE s.is_active = TRUE
                        AND ST_Distance(ST_Centroid(e.geom::geometry)::geography, s.coords) <= $1
                  )
                `,
                [args.maxDistanceM]
            );
        }

        const summary = await client.query(
            `
            SELECT
                COUNT(*)::int AS total_edges,
                COUNT(*) FILTER (WHERE flood_sensor_id IS NOT NULL)::int AS mapped_edges
            FROM road_edges
            WHERE is_active = TRUE
            `
        );

        await client.query('COMMIT');
        console.log(`✅ Mapped edges cập nhật: ${mapped.rowCount}`);
        if (args.clearOutOfRange) {
            console.log(`🧹 Cleared out-of-range edges: ${cleared.rowCount}`);
        }
        console.log(
            `📊 Active edges: ${summary.rows[0].total_edges}, mapped flood_sensor_id: ${summary.rows[0].mapped_edges}`
        );
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Lỗi mapping:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
