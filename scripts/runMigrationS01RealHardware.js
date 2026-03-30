/**
 * Cập nhật DB: S01 chuyển từ giả lập (Wokwi) sang mạch thật (LoRa/MQTT).
 * Chạy: npm run migrate:s01-real
 *
 * Local: dùng .env (DB_* hoặc DATABASE_URL).
 * Railway từ máy ngoài: DATABASE_URL (TCP proxy) + DB_SSL=false nếu cần.
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
        const sqlPath = path.join(__dirname, '..', 'database', 'migrate_sensor_s01_real.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        const { rows } = await client.query(
            `SELECT sensor_id, location_name, hardware_type, installation_height, is_active
             FROM sensors WHERE sensor_id = 'S01'`
        );
        if (!rows.length) {
            console.warn('⚠️ Không có sensor S01 trong DB. Thêm trạm (seed hoặc POST /api/sensors) rồi chạy lại migration.');
            process.exitCode = 1;
            return;
        }
        console.log('✅ Đã migration S01 → mạch thật (metadata).');
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
