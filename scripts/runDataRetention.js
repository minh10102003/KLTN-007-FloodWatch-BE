/**
 * Chạy xóa log cũ một lần (Neon / local).
 * npm run db:retention
 */
'use strict';

require('dotenv').config();
const { runRetentionOnce, getConfig, isEnabled } = require('../src/services/dataRetentionService');

(async () => {
    if (!isEnabled()) {
        console.log('DATA_RETENTION_ENABLED=false — bỏ qua.');
        process.exit(0);
    }
    console.log('Config:', getConfig());
    const result = await runRetentionOnce();
    console.log('Done:', result);
    process.exit(0);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
