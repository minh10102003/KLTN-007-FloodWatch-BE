/**
 * Cập nhật tọa độ + tên hiển thị S01 (Nguyễn Thái Sơn, P.4).
 * Chạy: npm run migrate:s01-location
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
            'migrate_sensor_s01_location_nguyen_thai_son.sql'
        );
        await client.query(fs.readFileSync(sqlPath, 'utf8'));
        const { rows } = await client.query(
            `SELECT sensor_id, location_name,
                    ST_Y(coords::geometry) AS lat,
                    ST_X(coords::geometry) AS lng
             FROM sensors WHERE sensor_id = 'S01'`
        );
        if (!rows.length) {
            console.warn('⚠️ Không có sensor S01.');
            process.exitCode = 1;
            return;
        }
        console.log('✅ Đã đổi vị trí S01:', rows[0]);
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
