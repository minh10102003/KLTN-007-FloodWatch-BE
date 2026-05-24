/**
 * Migration: skip_auto_approve trên crowd_reports
 * npm run migrate:skip-auto-approve
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const sqlPath = path.join(__dirname, '..', 'migrations', 'add_skip_auto_approve.sql');
        console.log('🔄 Đang chạy migrations/add_skip_auto_approve.sql ...');
        await pool.query(fs.readFileSync(sqlPath, 'utf8'));
        const cols = await pool.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'crowd_reports' AND column_name = 'skip_auto_approve'
        `);
        console.log(cols.rows.length ? '✅ Migration skip_auto_approve thành công.' : '⚠️ Cột chưa thấy — kiểm tra lại.');
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error('❌ Migration lỗi:', err.message);
    process.exit(1);
});
