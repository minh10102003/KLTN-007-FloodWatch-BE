/**
 * Migration: auto_approved, sensor_verified, nearby_report_count trên crowd_reports.
 * Chạy: node scripts/runMigrationAutoApprove.js
 */
const fs = require('fs');
const path = require('path');
const { buildPool, isValidPostgresUrl } = require('./dbPoolFromEnv');

function describeDbConfig() {
    const url = process.env.DATABASE_URL?.trim();
    if (url && isValidPostgresUrl(url)) {
        try {
            const u = new URL(url.replace(/^postgresql:/i, 'postgres:'));
            return `DATABASE_URL → ${u.hostname}:${u.port || 5432}/${u.pathname.replace(/^\//, '')}`;
        } catch {
            return 'DATABASE_URL (đã set)';
        }
    }
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 5432;
    const db = process.env.DB_NAME || '(chưa set DB_NAME)';
    return `DB_* → ${host}:${port}/${db}`;
}

function assertDbEnv() {
    const url = process.env.DATABASE_URL?.trim();
    const hasUrl = url && isValidPostgresUrl(url);
    const hasDbVars = process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER;
    if (hasUrl || hasDbVars) return;

    console.error('❌ Chưa cấu hình kết nối database.');
    console.error('   File .env đang trống hoặc thiếu biến (dotenv: 0 biến).');
    console.error('');
    console.error('   Cách 1 — Neon (khuyến nghị): copy connection string vào .env');
    console.error('   DATABASE_URL=postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require');
    console.error('');
    console.error('   Cách 2 — Postgres local: bật service Postgres rồi thêm vào .env');
    console.error('   DB_USER=postgres');
    console.error('   DB_HOST=localhost');
    console.error('   DB_NAME=hcm_flood_db');
    console.error('   DB_PASS=...');
    console.error('   DB_PORT=5432');
    console.error('');
    console.error('   Mẫu: copy .env.example → .env và điền giá trị thật.');
    process.exit(1);
}

async function run() {
    assertDbEnv();
    console.log('📡 Kết nối:', describeDbConfig());

    const pool = buildPool();
    let client;
    try {
        client = await pool.connect();
    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            console.error('❌ Không kết nối được Postgres (ECONNREFUSED).');
            console.error('   → Nếu dùng Neon: đặt DATABASE_URL trong .env (không dùng localhost).');
            console.error('   → Nếu dùng local: khởi động PostgreSQL trên máy.');
            console.error('   Hiện tại:', describeDbConfig());
        } else {
            console.error('❌ Lỗi kết nối:', err.message);
        }
        process.exit(1);
    }
    try {
        const sqlPath = path.join(__dirname, '..', 'migrations', 'add_auto_approve_fields.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('🔄 Đang chạy migrations/add_auto_approve_fields.sql ...');
        await client.query(sql);

        const check = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'crowd_reports'
              AND column_name IN ('auto_approved', 'sensor_verified', 'nearby_report_count')
            ORDER BY column_name
        `);
        console.log('✅ Migration thành công. Cột mới:', check.rows.map((r) => r.column_name).join(', '));
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

run();
