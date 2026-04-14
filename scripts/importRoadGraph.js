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
        defaultSpeedKmh: 35
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--file') out.file = argv[++i];
        else if (a === '--clear-existing') out.clearExisting = true;
        else if (a === '--default-speed-kmh') out.defaultSpeedKmh = Number(argv[++i]) || 35;
        else if (!a.startsWith('-') && !out.file) out.file = a; // fallback: positional file path
    }
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

async function upsertNode(client, cache, { lng, lat }) {
    const key = nodeKey(lng, lat);
    if (cache.has(key)) return cache.get(key);
    const row = await client.query(
        `
        INSERT INTO road_nodes (node_key, location)
        VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)
        ON CONFLICT (node_key)
        DO UPDATE SET node_key = EXCLUDED.node_key
        RETURNING id
        `,
        [key, lng, lat]
    );
    const id = Number(row.rows[0].id);
    cache.set(key, id);
    return id;
}

async function run() {
    const args = parseArgs(process.argv);
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
    console.log(`ℹ️  Đã parse ${segments.length} segments từ file ${path.basename(filePath)}.`);

    const pool = buildPool();
    const client = await pool.connect();
    const nodeCache = new Map();
    let insertedEdges = 0;
    try {
        await client.query('BEGIN');
        if (args.clearExisting) {
            await client.query('DELETE FROM road_edges');
            await client.query('DELETE FROM road_nodes');
            console.log('🧹 Đã xóa dữ liệu road_nodes/road_edges cũ.');
        }

        for (let idx = 0; idx < segments.length; idx++) {
            const seg = segments[idx];
            const fromId = await upsertNode(client, nodeCache, seg.from);
            const toId = await upsertNode(client, nodeCache, seg.to);
            if (fromId === toId) continue;
            const lengthM = haversineMeters(seg.from, seg.to);
            if (!Number.isFinite(lengthM) || lengthM <= 0.5) continue;

            await client.query(
                `
                INSERT INTO road_edges (
                    from_node_id, to_node_id, geom, length_m, speed_limit_mps, is_bidirectional
                )
                VALUES (
                    $1, $2,
                    ST_SetSRID(ST_MakeLine(ST_MakePoint($3, $4), ST_MakePoint($5, $6)), 4326)::geography,
                    $7,
                    $8, $9
                )
                `,
                [
                    fromId,
                    toId,
                    seg.from.lng,
                    seg.from.lat,
                    seg.to.lng,
                    seg.to.lat,
                    lengthM,
                    seg.speedLimitMps,
                    !!seg.isBidirectional
                ]
            );
            insertedEdges += 1;
            if ((idx + 1) % 1000 === 0) {
                console.log(
                    `⏳ Progress: ${idx + 1}/${segments.length} segments | nodes=${nodeCache.size} | edges=${insertedEdges}`
                );
            }
        }

        await client.query('COMMIT');
        console.log(`✅ Import xong: ${nodeCache.size} nodes, ${insertedEdges} edges.`);
        console.log('ℹ️  Tiếp theo: map flood_sensor_id cho road_edges hoặc cập nhật manual_flood_depth_cm để test.');
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
