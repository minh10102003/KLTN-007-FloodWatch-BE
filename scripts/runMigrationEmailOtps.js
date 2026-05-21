/**
 * Tạo bảng email_otps.
 * Chạy: node scripts/runMigrationEmailOtps.js
 *
 * Kết nối DB (ưu tiên):
 * 1) DATABASE_URL — copy connection string từ Neon Console.
 *    Nếu mật khẩu có @ # : / … phải URL-encode (vd @ → %40) hoặc dùng cách (2).
 * 2) DB_USER, DB_HOST, DB_NAME, DB_PASS, DB_PORT trong .env (không cần DATABASE_URL).
 *
 * PowerShell (chỉ session hiện tại, tránh .env lỗi đè):
 *   $env:DATABASE_URL="postgresql://..."
 *   npm run migrate:email-otps
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

function isValidPostgresUrl(str) {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    if (!s) return false;
    try {
        const normalized = s.replace(/^postgresql:/i, 'postgres:');
        new URL(normalized);
        return true;
    } catch {
        return false;
    }
}

/** Neon thường cần sslmode=require; nếu lỗi SSL thử DB_SSL=false (chỉ dev). */
function shouldUseSsl(connectionString) {
    if (process.env.DB_SSL === 'false') return false;
    if ((process.env.PGSSLMODE || '').toLowerCase() === 'disable') return false;
    if (connectionString) {
        try {
            const u = new URL(connectionString.replace(/^postgresql:/i, 'postgres:'));
            const m = (u.searchParams.get('sslmode') || '').toLowerCase();
            if (m === 'disable') return false;
        } catch {
            /* ignore */
        }
    }
    return true;
}

function buildPool() {
    const rawUrl = process.env.DATABASE_URL?.trim();
    if (rawUrl && isValidPostgresUrl(rawUrl)) {
        const ssl = shouldUseSsl(rawUrl);
        return new Pool({
            connectionString: rawUrl,
            ...(ssl ? { ssl: { rejectUnauthorized: false } } : {})
        });
    }
    if (rawUrl) {
        console.warn(
            '⚠️ DATABASE_URL trong .env không phải URL hợp lệ — bỏ qua, dùng DB_USER/DB_HOST/...\n' +
                '   (Nếu muốn dùng URL: copy nguyên từ Neon hoặc URL-encode ký tự đặc biệt trong password.)'
        );
    }
    return new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASS,
        port: process.env.DB_PORT
    });
}

const pool = buildPool();

async function run() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '..', 'database', 'email_otps.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('✅ Đã tạo bảng email_otps.');
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
