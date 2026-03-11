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
        
        const databaseDir = path.join(__dirname, '..', 'database');
        const migrationFiles = ['add_new_features.sql', 'add_is_online_to_users.sql', 'add_access_logs.sql'];
        
        await client.query('BEGIN');
        for (const file of migrationFiles) {
            const filePath = path.join(databaseDir, file);
            if (fs.existsSync(filePath)) {
                const sql = fs.readFileSync(filePath, 'utf8');
                await client.query(sql);
                console.log('  ✓', file);
            }
        }
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

