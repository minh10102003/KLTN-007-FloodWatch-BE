/**
 * Migration: Thêm cột temperature và humidity vào flood_logs (DHT22).
 * Chạy: node scripts/runMigrationTemperatureHumidity.js
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

const statements = [
    `ALTER TABLE flood_logs ADD COLUMN IF NOT EXISTS temperature FLOAT`,
    `COMMENT ON COLUMN flood_logs.temperature IS 'Nhiệt độ (°C) từ DHT22, optional'`,
    `ALTER TABLE flood_logs ADD COLUMN IF NOT EXISTS humidity FLOAT`,
    `COMMENT ON COLUMN flood_logs.humidity IS 'Độ ẩm (%) từ DHT22, optional'`,
];

async function run() {
    const client = await pool.connect();
    try {
        for (const sql of statements) {
            await client.query(sql);
        }
        console.log('✅ Đã thêm cột temperature và humidity vào flood_logs (nếu chưa có).');
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
