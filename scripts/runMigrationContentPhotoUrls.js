/**
 * Migration: Thêm cột content và photo_urls vào crowd_reports.
 * Chạy: node scripts/runMigrationContentPhotoUrls.js
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
    `ALTER TABLE crowd_reports ADD COLUMN IF NOT EXISTS content VARCHAR(500)`,
    `COMMENT ON COLUMN crowd_reports.content IS 'Nội dung mô tả mức độ ngập (tùy chọn, tối đa 500 ký tự)'`,
    `ALTER TABLE crowd_reports ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb`,
    `COMMENT ON COLUMN crowd_reports.photo_urls IS 'Mảng URL ảnh (JSON array), tối đa 5 ảnh; photo_url = ảnh đầu để tương thích'`,
];

async function run() {
    const client = await pool.connect();
    try {
        for (const sql of statements) {
            await client.query(sql);
        }
        console.log('✅ Đã thêm cột content và photo_urls vào crowd_reports (nếu chưa có).');
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
