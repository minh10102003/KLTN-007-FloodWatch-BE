/**
 * Migration: Thêm cột last_calibrated_at vào sensors (Calibrate Sensor).
 * Chạy: node scripts/runMigrationLastCalibrated.js
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
    `ALTER TABLE sensors ADD COLUMN IF NOT EXISTS last_calibrated_at TIMESTAMP`,
    `COMMENT ON COLUMN sensors.last_calibrated_at IS 'Thời điểm admin thực hiện Calibrate Sensor lần cuối'`,
];

async function run() {
    const client = await pool.connect();
    try {
        for (const sql of statements) {
            await client.query(sql);
        }
        console.log('✅ Đã thêm cột last_calibrated_at vào sensors (nếu chưa có).');
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
