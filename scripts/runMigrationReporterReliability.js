const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

/**
 * Chạy migration: thêm cột reporter_reliability vào users (điểm tin cậy Cách C).
 */

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
        const filePath = path.join(__dirname, '..', 'database', 'add_reporter_reliability_to_users.sql');
        if (!fs.existsSync(filePath)) {
            console.error('❌ Không tìm thấy database/add_reporter_reliability_to_users.sql');
            process.exit(1);
        }
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log('✅ Đã thêm cột reporter_reliability vào users (mặc định 50)');
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
