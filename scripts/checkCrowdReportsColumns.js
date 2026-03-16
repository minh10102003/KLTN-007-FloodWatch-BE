/**
 * Kiểm tra các cột của bảng crowd_reports (đặc biệt content, photo_urls).
 * Chạy: node scripts/checkCrowdReportsColumns.js
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

async function run() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'crowd_reports'
            ORDER BY ordinal_position
        `);
        console.log('Các cột trong bảng crowd_reports:\n');
        const hasContent = res.rows.some(r => r.column_name === 'content');
        const hasPhotoUrls = res.rows.some(r => r.column_name === 'photo_urls');
        res.rows.forEach(r => {
            const len = r.character_maximum_length ? `(${r.character_maximum_length})` : '';
            console.log(`  - ${r.column_name}: ${r.data_type}${len}`);
        });
        console.log('');
        if (hasContent && hasPhotoUrls) {
            console.log('✅ Đã có cột content và photo_urls.');
        } else {
            console.log('❌ Thiếu cột:');
            if (!hasContent) console.log('   - content');
            if (!hasPhotoUrls) console.log('   - photo_urls');
            console.log('\nChạy migration: npm run migrate:content-photo-urls');
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
