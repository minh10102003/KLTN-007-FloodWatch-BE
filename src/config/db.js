const { Pool } = require('pg');
require('dotenv').config();

// Cấu hình kết nối PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

// Kiểm tra kết nối DB ngay khi khởi động
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Lỗi kết nối Database:', err.stack);
        return;
    }
    console.log('✅ Đã kết nối thành công tới PostgreSQL!');
    release();
});

module.exports = pool;

