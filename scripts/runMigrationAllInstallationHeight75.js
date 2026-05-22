/**
 * Gán installation_height = 75 cm cho mọi sensor đang > 75 (thường là 150).
 * Chạy: npm run migrate:installation-height-75-all
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL
    ? new Pool({
          connectionString: process.env.DATABASE_URL,
          ...(process.env.DB_SSL === 'false' ? {} : { ssl: { rejectUnauthorized: false } })
      })
    : new Pool({
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          password: process.env.DB_PASS,
          port: process.env.DB_PORT
      });

async function run() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(
            __dirname,
            '..',
            'database',
            'migrate_all_installation_height_75.sql'
        );
        const res = await client.query(fs.readFileSync(sqlPath, 'utf8'));
        const { rows } = await client.query(
            `SELECT sensor_id, location_name, installation_height
             FROM sensors
             ORDER BY sensor_id`
        );
        console.log('✅ installation_height → 75 cm (rowCount UPDATE:', res.rowCount ?? 0, ')');
        for (const r of rows) {
            console.log(`   ${r.sensor_id}: ${r.location_name} — H=${r.installation_height} cm`);
        }
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
