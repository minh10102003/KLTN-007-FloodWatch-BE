/**
 * Migration thêm cột avatar vào bảng users.
 * Chạy: node scripts/runMigrationAvatar.js
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
        const sqlPath = path.join(__dirname, '..', 'database', 'add_avatar_to_users.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('✅ Đã thêm cột avatar vào bảng users.');
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
