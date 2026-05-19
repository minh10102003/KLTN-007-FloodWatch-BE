'use strict';

/**
 * Import database/hcm_flood_neon.sql vào DATABASE_URL (.env) qua psql
 * (COPY ... FROM stdin cần psql, không chạy được bằng pg.query một khối).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DUMP = path.join(__dirname, '..', 'database', 'hcm_flood_neon.sql');

function main() {
    if (!fs.existsSync(DUMP)) {
        console.error('Chưa có file. Chạy: npm run db:build-neon-import');
        process.exit(1);
    }
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
        console.error('DATABASE_URL chưa set trong .env');
        process.exit(1);
    }

    console.log('🔄 Import qua psql:', DUMP);
    const result = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', DUMP], {
        stdio: 'inherit',
        env: process.env,
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        console.error('❌ psql exit code', result.status);
        process.exit(result.status || 1);
    }

    console.log('✅ Import xong. Kiểm tra: npm run db:neon-stats (nếu có) hoặc SQL Editor Neon.');
}

main();
