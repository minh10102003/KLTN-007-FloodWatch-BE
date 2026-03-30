/**
 * Gán sensors.installation_height = 100 (cm) cho S01.
 * Chạy: npm run migrate:s01-height-100
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
        const sqlPath = path.join(__dirname, '..', 'database', 'migrate_sensor_s01_installation_height_100.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const res = await client.query(sql);
        const n = res.rowCount ?? 0;
        const { rows } = await client.query(
            `SELECT sensor_id, installation_height FROM sensors WHERE sensor_id = 'S01'`
        );
        if (!rows.length) {
            console.warn('⚠️ Không có sensor S01 trong DB.');
            process.exitCode = 1;
            return;
        }
        console.log('✅ Đã cập nhật installation_height S01 = 100 cm (rowCount UPDATE:', n + ').');
        console.log('   ', rows[0]);
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
