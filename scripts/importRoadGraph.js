/**
 * Import road graph vào road_nodes + road_edges từ GeoJSON hoặc OSM XML.
 *
 * Usage:
 *   node scripts/importRoadGraph.js --file ./data/roads.geojson
 *   node scripts/importRoadGraph.js --file ./data/roads.osm --default-speed-kmh 35
 *
 * Chấp nhận:
 * - GeoJSON FeatureCollection (LineString / MultiLineString)
 * - OSM XML (nodes + ways có tag highway)
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

function parseArgs(argv) {
    const out = {
        file: null,
        clearExisting: false,
        defaultSpeedKmh: 35,
        batchSize: 5000,
        lockTimeoutMs: 5000,
        terminateLockers: false
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--file') out.file = argv[++i];
        else if (a === '--clear-existing') out.clearExisting = true;
        else if (a === '--default-speed-kmh') out.defaultSpeedKmh = Number(argv[++i]) || 35;
        else if (a === '--batch-size') out.batchSize = Number(argv[++i]) || 5000;
        else if (a === '--lock-timeout-ms') out.lockTimeoutMs = Number(argv[++i]) || 5000;
        else if (a === '--terminate-lockers') out.terminateLockers = true;
        else if (a === '--help' || a === '-h') out.help = true;
        else if (!a.startsWith('-') && !out.file) out.file = a; // fallback: positional file path
    }
    out.batchSize = Math.min(20000, Math.max(500, out.batchSize));
    out.lockTimeoutMs = Math.min(60000, Math.max(1000, out.lockTimeoutMs));
    return out;
}

function printHelp() {
    console.log(`
Usage:
  node scripts/importRoadGraph.js --file ./data/roads.geojson [options]
  node scripts/importRoadGraph.js ./data/roads.geojson [options]

Options:
  --clear-existing            Truncate road_nodes/road_edges trước khi import
  --default-speed-kmh <n>     Tốc độ mặc định khi thiếu maxspeed/highway (default: 35)
  --batch-size <n>            Cỡ batch insert nodes/edges (default: 5000)
  --lock-timeout-ms <ms>      lock_timeout khi truncate/import (default: 5000)
  --terminate-lockers         Tự terminate session đang khóa road_nodes/road_edges
  -h, --help                  Hiện trợ giúp
`);
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

function speedFromHighway(highway, fallbackKmh) {
    const h = String(highway || '').toLowerCase();
    if (h.includes('motorway')) return 80;
    if (h.includes('trunk')) return 60;
    if (h.includes('primary')) return 50;
    if (h.includes('secondary')) return 45;
    if (h.includes('tertiary')) return 40;
    if (h.includes('residential') || h.includes('service')) return 30;
    return fallbackKmh;
}

function parseMaxspeedToKmh(maxspeed, fallbackKmh) {
    if (!maxspeed) return fallbackKmh;
    const s = String(maxspeed).toLowerCase();
    const n = Number(s.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return fallbackKmh;
    if (s.includes('mph')) return n * 1.60934;
    return n;
}

function toMps(kmh) {
    return Math.max(1, Number(kmh) / 3.6);
}

function nodeKey(lng, lat) {
    return `${Number(lng).toFixed(7)},${Number(lat).toFixed(7)}`;
}

function haversineMeters(a, b) {
    const R = 6371000;
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
}

function parseGeoJson(content, defaultSpeedKmh) {
    const obj = JSON.parse(content);
    const features = Array.isArray(obj.features) ? obj.features : [];
    const segments = [];
    for (const f of features) {
        const geom = f?.geometry;
        if (!geom) continue;
        const props = f.properties || {};
        const speedKmh = parseMaxspeedToKmh(
            props.maxspeed,
            speedFromHighway(props.highway || props.road_type, defaultSpeedKmh)
        );
        const bidirectional = String(props.oneway || '').toLowerCase() !== 'yes';
        const pushLine = (coords) => {
            if (!Array.isArray(coords) || coords.length < 2) return;
            for (let i = 1; i < coords.length; i++) {
                const [lng1, lat1] = coords[i - 1];
                const [lng2, lat2] = coords[i];
                if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) continue;
                segments.push({
                    from: { lng: Number(lng1), lat: Number(lat1) },
                    to: { lng: Number(lng2), lat: Number(lat2) },
                    speedLimitMps: toMps(speedKmh),
                    isBidirectional: bidirectional
                });
            }
        };
        if (geom.type === 'LineString') pushLine(geom.coordinates);
        if (geom.type === 'MultiLineString') {
            for (const ls of geom.coordinates || []) pushLine(ls);
        }
    }
    return segments;
}

function parseOsmXml(content, defaultSpeedKmh) {
    const nodeMap = new Map();
    const segments = [];

    const nodeRegex = /<node\b([^>]*?)\/>/g;
    let m;
    while ((m = nodeRegex.exec(content))) {
        const attrs = m[1];
        const id = /id="([^"]+)"/.exec(attrs)?.[1];
        const lat = Number(/lat="([^"]+)"/.exec(attrs)?.[1]);
        const lon = Number(/lon="([^"]+)"/.exec(attrs)?.[1]);
        if (id && Number.isFinite(lat) && Number.isFinite(lon)) nodeMap.set(id, { lng: lon, lat });
    }

    const wayRegex = /<way\b[^>]*>([\s\S]*?)<\/way>/g;
    while ((m = wayRegex.exec(content))) {
        const body = m[1];
        const refs = [];
        let r;
        const ndRegex = /<nd\s+ref="([^"]+)"\s*\/>/g;
        while ((r = ndRegex.exec(body))) refs.push(r[1]);
        if (refs.length < 2) continue;

        const tags = {};
        const tagRegex = /<tag\s+k="([^"]+)"\s+v="([^"]+)"\s*\/>/g;
        while ((r = tagRegex.exec(body))) tags[r[1]] = r[2];
        if (!tags.highway) continue;

        const speedKmh = parseMaxspeedToKmh(tags.maxspeed, speedFromHighway(tags.highway, defaultSpeedKmh));
        const isBidirectional = String(tags.oneway || '').toLowerCase() !== 'yes';

        for (let i = 1; i < refs.length; i++) {
            const a = nodeMap.get(refs[i - 1]);
            const b = nodeMap.get(refs[i]);
            if (!a || !b) continue;
            segments.push({
                from: { lng: a.lng, lat: a.lat },
                to: { lng: b.lng, lat: b.lat },
                speedLimitMps: toMps(speedKmh),
                isBidirectional
            });
        }
    }
    return segments;
}

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function fmtMs(ms) {
    if (ms < 1000) return `${ms}ms`;
    const s = (ms / 1000).toFixed(1);
    return `${s}s`;
}

function nowIso() {
    return new Date().toISOString();
}

async function upsertNodesBatch(client, nodes, batchSize) {
    const chunks = chunkArray(nodes, batchSize);
    let done = 0;
    const t0 = Date.now();
    for (const c of chunks) {
        const keys = c.map((n) => n.key);
        const lngs = c.map((n) => n.lng);
        const lats = c.map((n) => n.lat);
        await client.query(
            `
            INSERT INTO road_nodes (node_key, location)
            SELECT
                t.node_key,
                ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326)::geography
            FROM UNNEST($1::text[], $2::double precision[], $3::double precision[]) AS t(node_key, lng, lat)
            ON CONFLICT (node_key) DO NOTHING
            `,
            [keys, lngs, lats]
        );
        done += c.length;
        if (done % (batchSize * 2) === 0 || done === nodes.length) {
            const elapsed = Date.now() - t0;
            const rps = elapsed > 0 ? Math.round((done * 1000) / elapsed) : 0;
            console.log(`[${nowIso()}] ⏳ Nodes upsert: ${done}/${nodes.length} | ${rps}/s | elapsed=${fmtMs(elapsed)}`);
        }
    }
}

async function loadNodeIdMap(client, nodeKeys, batchSize) {
    const idMap = new Map();
    const chunks = chunkArray(nodeKeys, batchSize);
    let done = 0;
    const t0 = Date.now();
    for (const c of chunks) {
        const rows = await client.query(
            `SELECT id, node_key FROM road_nodes WHERE node_key = ANY($1::text[])`,
            [c]
        );
        for (const r of rows.rows) idMap.set(r.node_key, Number(r.id));
        done += c.length;
        if (done % (batchSize * 2) === 0 || done === nodeKeys.length) {
            const elapsed = Date.now() - t0;
            const rps = elapsed > 0 ? Math.round((done * 1000) / elapsed) : 0;
            console.log(
                `[${nowIso()}] ⏳ Node IDs loaded: ${done}/${nodeKeys.length} | ${rps}/s | elapsed=${fmtMs(elapsed)}`
            );
        }
    }
    return idMap;
}

async function insertEdgesBatch(client, edges, batchSize) {
    const chunks = chunkArray(edges, batchSize);
    let inserted = 0;
    const t0 = Date.now();
    for (const c of chunks) {
        const fromIds = c.map((e) => e.fromId);
        const toIds = c.map((e) => e.toId);
        const fromLngs = c.map((e) => e.from.lng);
        const fromLats = c.map((e) => e.from.lat);
        const toLngs = c.map((e) => e.to.lng);
        const toLats = c.map((e) => e.to.lat);
        const lengths = c.map((e) => e.lengthM);
        const speeds = c.map((e) => e.speedLimitMps);
        const bis = c.map((e) => e.isBidirectional);

        await client.query(
            `
            INSERT INTO road_edges (
                from_node_id, to_node_id, geom, length_m, speed_limit_mps, is_bidirectional
            )
            SELECT
                t.from_id,
                t.to_id,
                ST_SetSRID(ST_MakeLine(ST_MakePoint(t.from_lng, t.from_lat), ST_MakePoint(t.to_lng, t.to_lat)), 4326)::geography,
                t.length_m,
                t.speed_mps,
                t.is_bi
            FROM UNNEST(
                $1::bigint[],
                $2::bigint[],
                $3::double precision[],
                $4::double precision[],
                $5::double precision[],
                $6::double precision[],
                $7::double precision[],
                $8::double precision[],
                $9::boolean[]
            ) AS t(from_id, to_id, from_lng, from_lat, to_lng, to_lat, length_m, speed_mps, is_bi)
            `,
            [fromIds, toIds, fromLngs, fromLats, toLngs, toLats, lengths, speeds, bis]
        );
        inserted += c.length;
        if (inserted % (batchSize * 2) === 0 || inserted === edges.length) {
            const elapsed = Date.now() - t0;
            const rps = elapsed > 0 ? Math.round((inserted * 1000) / elapsed) : 0;
            console.log(
                `[${nowIso()}] ⏳ Edges inserted: ${inserted}/${edges.length} | ${rps}/s | elapsed=${fmtMs(elapsed)}`
            );
        }
    }
    return inserted;
}

async function truncateRoadTables(client, args) {
    const doTruncate = async () => {
        await client.query('BEGIN');
        await client.query(`SET LOCAL lock_timeout = '${args.lockTimeoutMs}ms'`);
        await client.query('TRUNCATE TABLE road_edges, road_nodes RESTART IDENTITY CASCADE');
        await client.query('COMMIT');
    };

    const tClear = Date.now();
    console.log(`[${nowIso()}] 🧹 Đang xóa dữ liệu road_nodes/road_edges cũ (TRUNCATE)...`);
    try {
        await doTruncate();
        console.log(`[${nowIso()}] 🧹 Đã xóa dữ liệu road_nodes/road_edges cũ. (${fmtMs(Date.now() - tClear)})`);
        return;
    } catch (e) {
        // đảm bảo thoát transaction lỗi nếu có
        try {
            await client.query('ROLLBACK');
        } catch {
            /* ignore */
        }

        const lockErr = e.code === '55P03' || /lock timeout/i.test(e.message || '');
        if (!lockErr || !args.terminateLockers) throw e;

        console.warn(`[${nowIso()}] ⚠️  TRUNCATE bị block bởi lock. Đang tìm và terminate blockers...`);
        const selfPid = Number((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
        const blockers = await client.query(
            `
            SELECT DISTINCT a.pid
            FROM pg_locks l
            JOIN pg_class c ON c.oid = l.relation
            JOIN pg_stat_activity a ON a.pid = l.pid
            WHERE c.relname IN ('road_edges', 'road_nodes')
              AND a.pid <> $1
              AND l.granted = true
            `,
            [selfPid]
        );
        for (const b of blockers.rows) {
            const pid = Number(b.pid);
            if (!Number.isFinite(pid) || pid <= 0) continue;
            const r = await client.query('SELECT pg_terminate_backend($1) AS ok', [pid]);
            console.warn(`[${nowIso()}] 🛑 terminate pid=${pid} => ${r.rows[0].ok ? 'ok' : 'failed'}`);
        }

        await doTruncate();
        console.log(`[${nowIso()}] 🧹 Đã xóa dữ liệu road_nodes/road_edges cũ sau khi dọn lock. (${fmtMs(Date.now() - tClear)})`);
    }
}

async function run() {
    const allStart = Date.now();
    const args = parseArgs(process.argv);
    if (args.help) {
        printHelp();
        return;
    }
    if (!args.file) {
        console.error('❌ Thiếu --file <path-to-geojson-or-osm>');
        process.exit(1);
    }
    const filePath = path.resolve(process.cwd(), args.file);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Không tìm thấy file: ${filePath}`);
        process.exit(1);
    }

    const ext = path.extname(filePath).toLowerCase();
    const raw = fs.readFileSync(filePath, 'utf8');
    let segments = [];
    if (ext === '.geojson' || ext === '.json') {
        segments = parseGeoJson(raw, args.defaultSpeedKmh);
    } else if (ext === '.osm' || ext === '.xml') {
        segments = parseOsmXml(raw, args.defaultSpeedKmh);
    } else {
        console.error('❌ Chỉ hỗ trợ .geojson/.json hoặc .osm/.xml');
        process.exit(1);
    }

    if (!segments.length) {
        console.error('❌ Không parse được segment nào từ file input.');
        process.exit(1);
    }
    console.log(`[${nowIso()}] ℹ️  Đã parse ${segments.length} segments từ file ${path.basename(filePath)}.`);

    const pool = buildPool();
    const client = await pool.connect();
    try {
        if (args.clearExisting) {
            await truncateRoadTables(client, args);
        }

        await client.query('BEGIN');
        await client.query(`SET LOCAL lock_timeout = '${args.lockTimeoutMs}ms'`);
        await client.query('SET LOCAL synchronous_commit = OFF');

        const tPrepare = Date.now();
        console.log(`[${nowIso()}] ⚙️  Chuẩn bị node/edge với batchSize=${args.batchSize}...`);
        const nodeObjMap = new Map();
        const preparedEdges = [];
        for (let idx = 0; idx < segments.length; idx++) {
            const seg = segments[idx];
            const fromKey = nodeKey(seg.from.lng, seg.from.lat);
            const toKey = nodeKey(seg.to.lng, seg.to.lat);
            if (!nodeObjMap.has(fromKey)) nodeObjMap.set(fromKey, { key: fromKey, lng: seg.from.lng, lat: seg.from.lat });
            if (!nodeObjMap.has(toKey)) nodeObjMap.set(toKey, { key: toKey, lng: seg.to.lng, lat: seg.to.lat });
            const lengthM = haversineMeters(seg.from, seg.to);
            if (!Number.isFinite(lengthM) || lengthM <= 0.5) continue;
            preparedEdges.push({
                fromKey,
                toKey,
                from: seg.from,
                to: seg.to,
                lengthM,
                speedLimitMps: seg.speedLimitMps,
                isBidirectional: !!seg.isBidirectional
            });
            if ((idx + 1) % 50000 === 0) {
                const elapsed = Date.now() - tPrepare;
                const rps = elapsed > 0 ? Math.round(((idx + 1) * 1000) / elapsed) : 0;
                console.log(
                    `[${nowIso()}] ⏳ Prepare: ${idx + 1}/${segments.length} | ${rps}/s | elapsed=${fmtMs(elapsed)}`
                );
            }
        }
        const nodes = Array.from(nodeObjMap.values());
        console.log(
            `[${nowIso()}] ℹ️  Unique nodes=${nodes.length}, prepared edges=${preparedEdges.length} | prepare=${fmtMs(Date.now() - tPrepare)}`
        );

        await upsertNodesBatch(client, nodes, args.batchSize);
        const idMap = await loadNodeIdMap(
            client,
            nodes.map((n) => n.key),
            args.batchSize
        );

        const edgeRows = [];
        for (const e of preparedEdges) {
            const fromId = idMap.get(e.fromKey);
            const toId = idMap.get(e.toKey);
            if (!fromId || !toId || fromId === toId) continue;
            edgeRows.push({
                fromId,
                toId,
                from: e.from,
                to: e.to,
                lengthM: e.lengthM,
                speedLimitMps: e.speedLimitMps,
                isBidirectional: e.isBidirectional
            });
        }
        console.log(`[${nowIso()}] ℹ️  Edges ready to insert=${edgeRows.length}`);
        const insertedEdges = await insertEdgesBatch(client, edgeRows, args.batchSize);

        await client.query('COMMIT');
        console.log(
            `[${nowIso()}] ✅ Import xong: ${nodes.length} nodes, ${insertedEdges} edges. Tổng thời gian ${fmtMs(Date.now() - allStart)}`
        );
        console.log(
            `[${nowIso()}] ℹ️  Tiếp theo: map flood_sensor_id cho road_edges hoặc cập nhật manual_flood_depth_cm để test.`
        );
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Import thất bại:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
