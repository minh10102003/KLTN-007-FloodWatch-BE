/**
 * Thêm ingest_key + unique index cho flood_logs (idempotent MQTT).
 * Chạy: node scripts/runMigrationFloodLogsIngestKey.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

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

const pool = buildPool();

async function run() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '..', 'database', 'add_flood_logs_ingest_key.sql');
        await client.query(fs.readFileSync(sqlPath, 'utf8'));
        console.log('✅ Đã thêm ingest_key + UNIQUE(sensor_id, ingest_key) cho flood_logs.');
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
