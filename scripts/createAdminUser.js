const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'hcm_flood',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres'
});

async function createAdminUser() {
    try {
        const username = 'admin';
        const email = 'admin@hcm-flood.gov.vn';
        const password = 'admin123'; // Mật khẩu mặc định
        const full_name = 'System Administrator';
        const role = 'admin';

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);
        console.log('✅ Password đã được hash');

        // Kiểm tra xem admin đã tồn tại chưa
        const checkQuery = 'SELECT id, username FROM users WHERE username = $1';
        const existing = await pool.query(checkQuery, [username]);

        if (existing.rows.length > 0) {
            // Cập nhật password cho admin hiện có
            const updateQuery = `
                UPDATE users 
                SET password_hash = $1, 
                    email = $2, 
                    full_name = $3, 
                    role = $4,
                    is_active = true,
                    updated_at = CURRENT_TIMESTAMP
                WHERE username = $5
                RETURNING id, username, email, role
            `;
            const result = await pool.query(updateQuery, [
                password_hash,
                email,
                full_name,
                role,
                username
            ]);
            console.log('✅ Đã cập nhật password cho admin user:');
            console.log(`   Username: ${result.rows[0].username}`);
            console.log(`   Email: ${result.rows[0].email}`);
            console.log(`   Role: ${result.rows[0].role}`);
            console.log(`   Password: ${password}`);
        } else {
            // Tạo admin user mới
            const insertQuery = `
                INSERT INTO users (username, email, password_hash, full_name, role, is_active)
                VALUES ($1, $2, $3, $4, $5, true)
                RETURNING id, username, email, role
            `;
            const result = await pool.query(insertQuery, [
                username,
                email,
                password_hash,
                full_name,
                role
            ]);
            console.log('✅ Đã tạo admin user mới:');
            console.log(`   Username: ${result.rows[0].username}`);
            console.log(`   Email: ${result.rows[0].email}`);
            console.log(`   Role: ${result.rows[0].role}`);
            console.log(`   Password: ${password}`);
        }

        console.log('\n📝 Thông tin đăng nhập:');
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${password}`);
        console.log(`   Email: ${email}`);
        console.log('\n⚠️  LƯU Ý: Sau khi đăng nhập thành công, hãy đổi mật khẩu ngay!');

    } catch (error) {
        console.error('❌ Lỗi khi tạo admin user:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Chạy script
createAdminUser();

