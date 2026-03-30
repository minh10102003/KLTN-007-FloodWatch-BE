const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL: local dùng DB_*; Railway/Heroku thường có DATABASE_URL
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

