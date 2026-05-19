const fs = require('fs');
const path = require('path');
const { buildPool } = require('./dbPoolFromEnv');

/**
 * Script để chạy database migration
 * Sử dụng Node.js thay vì psql command line
 */

const pool = buildPool();

async function runMigration() {
    const client = await pool.connect();

    try {
        const check = await client.query(
            `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sensors'`
        );
        if (check.rowCount === 0) {
            console.error(
                '❌ Chưa có bảng sensors. Chạy schema gốc trước:\n   npm run db:schema\n   rồi npm run migrate'
            );
            process.exit(1);
        }

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

