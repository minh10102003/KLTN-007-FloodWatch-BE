'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set in .env');
        process.exit(1);
    }
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
        const { rows } = await pool.query(
            `SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'`
        );
        console.log('PostGIS:', rows[0] || 'not found');
        const ver = await pool.query('SELECT version() AS v, current_database() AS db');
        console.log('DB:', ver.rows[0].db);
        console.log(ver.rows[0].v);
    } finally {
        await pool.end();
    }
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
