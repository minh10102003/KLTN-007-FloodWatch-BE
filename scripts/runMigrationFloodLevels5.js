/**
 * Migration: flood_level 5 mức (Mức 1–5)
 * Chạy: npm run migrate:flood-levels
 */
const fs = require('fs');
const path = require('path');
const { buildPool } = require('./dbPoolFromEnv');

async function run() {
    const pool = buildPool();
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '..', 'migrations', 'migrate_flood_levels_5_tiers.sql');
        console.log('🔄 Đang chạy migrations/migrate_flood_levels_5_tiers.sql ...');
        await client.query(fs.readFileSync(sqlPath, 'utf8'));

        const check = await client.query(`
            SELECT flood_level, COUNT(*)::int AS cnt
            FROM crowd_reports
            GROUP BY flood_level
            ORDER BY flood_level
        `);
        console.log('✅ Migration thành công. Phân bố flood_level:');
        console.table(check.rows);
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
