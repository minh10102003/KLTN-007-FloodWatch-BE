'use strict';

/** Xóa road_nodes/road_edges (giải phóng dung lượng Neon sau import lỗi). */
const { buildPool } = require('./dbPoolFromEnv');

async function main() {
    const pool = buildPool();
    const client = await pool.connect();
    try {
        await client.query('TRUNCATE road_edges, road_nodes RESTART IDENTITY CASCADE');
        console.log('✅ Đã TRUNCATE road_edges, road_nodes');
        console.log('   Trên Neon Console có thể chạy thêm: VACUUM FULL; (nếu vẫn gần 512 MB)');
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
