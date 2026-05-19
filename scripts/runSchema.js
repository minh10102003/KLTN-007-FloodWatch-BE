'use strict';

const fs = require('fs');
const path = require('path');
const { buildPool } = require('./dbPoolFromEnv');

const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');

async function main() {
    if (!fs.existsSync(schemaPath)) {
        console.error('Không tìm thấy', schemaPath);
        process.exit(1);
    }
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const pool = buildPool();
    const client = await pool.connect();
    try {
        console.log('🔄 Đang chạy database/schema.sql trên DB hiện tại...');
        await client.query(sql);
        const { rows } = await client.query(
            `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
        );
        console.log('✅ Schema OK. Bảng public:', rows.map((r) => r.tablename).join(', '));
    } catch (e) {
        console.error('❌ Lỗi schema:', e.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
