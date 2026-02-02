const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

/**
 * Script để chạy database migration
 * Sử dụng Node.js thay vì psql command line
 */

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Đang chạy migration...');
        
        // Đọc file SQL
        const migrationFile = path.join(__dirname, '..', 'database', 'add_new_features.sql');
        const sql = fs.readFileSync(migrationFile, 'utf8');
        
        // Chạy migration
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log('✅ Migration thành công!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Lỗi khi chạy migration:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();

