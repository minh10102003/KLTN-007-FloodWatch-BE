/**
 * Migration: Thêm cột photo_url vào crowd_reports (ảnh báo cáo ngập).
 * Chạy: node scripts/runMigrationPhotoUrl.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

async function run() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '..', 'database', 'add_photo_url_to_crowd_reports.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('✅ Đã thêm cột photo_url vào crowd_reports (nếu chưa có).');
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
