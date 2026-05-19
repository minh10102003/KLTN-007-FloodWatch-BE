'use strict';

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

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

/** Pool từ DATABASE_URL (Neon/Railway) hoặc DB_* (local). */
function buildPool() {
    const rawUrl = process.env.DATABASE_URL?.trim();
    if (rawUrl && isValidPostgresUrl(rawUrl)) {
        const ssl = shouldUseSsl(rawUrl);
        return new Pool({
            connectionString: rawUrl,
            ...(ssl ? { ssl: { rejectUnauthorized: false } } : {}),
        });
    }
    return new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASS,
        port: process.env.DB_PORT,
    });
}

module.exports = { buildPool, isValidPostgresUrl, shouldUseSsl };
