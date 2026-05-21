/**
 * Cập nhật location_name 3 trạm (S01, NODE_007/S02, S03).
 * Chạy: npm run migrate:sensor-display-names
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
        const sqlPath = path.join(__dirname, '..', 'database', 'migrate_sensor_display_names.sql');
        await client.query(fs.readFileSync(sqlPath, 'utf8'));

        const { rows } = await client.query(
            `SELECT sensor_id, location_name FROM sensors
             WHERE sensor_id IN ('S01', 'S02', 'S03', 'NODE_007')
             ORDER BY sensor_id`
        );
        console.log('✅ Đã cập nhật tên trạm:');
        for (const r of rows) {
            console.log(`   ${r.sensor_id}: ${r.location_name}`);
        }
        if (!rows.length) {
            console.warn('⚠️ Không có bản ghi S01/S03/NODE_007 — chạy seed trước.');
            process.exitCode = 1;
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
