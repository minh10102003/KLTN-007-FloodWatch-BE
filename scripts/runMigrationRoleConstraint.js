const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

/**
 * Chạy migration: thêm CHECK constraint cho users.role (chỉ cho phép user, moderator, admin).
 * Chạy sau khi đảm bảo không có user nào có role khác 3 giá trị trên.
 * Nếu có role lạ, trước tiên cập nhật: UPDATE users SET role = 'user' WHERE role NOT IN ('user','moderator','admin');
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
        const filePath = path.join(__dirname, '..', 'database', 'add_role_constraint.sql');
        if (!fs.existsSync(filePath)) {
            console.error('❌ Không tìm thấy database/add_role_constraint.sql');
            process.exit(1);
        }
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log('✅ Đã thêm constraint chk_user_role (role IN user, moderator, admin)');
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
