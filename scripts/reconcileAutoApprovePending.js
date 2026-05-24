/**
 * Quét lại mọi báo cáo pending — kích hoạt auto-approve cụm (≥5 cùng vùng + cùng mức ngập).
 * Chạy: node scripts/reconcileAutoApprovePending.js
 */
const { buildPool } = require('./dbPoolFromEnv');
const { checkAutoApprove } = require('../src/services/autoApproveService');

async function run() {
    const pool = buildPool();
    const client = await pool.connect();
    try {
        const { rows: pending } = await client.query(`
            SELECT id
            FROM crowd_reports
            WHERE moderation_status = 'pending'
              AND COALESCE(auto_approved, FALSE) = FALSE
            ORDER BY created_at DESC
        `);

        console.log(`🔄 Quét ${pending.length} báo cáo pending...`);
        let totalApproved = 0;
        const seen = new Set();

        for (const { id } of pending) {
            const result = await checkAutoApprove(id);
            if (!result.ok) continue;
            for (const approvedId of result.autoApprovedIds || []) {
                if (!seen.has(approvedId)) {
                    seen.add(approvedId);
                    totalApproved += 1;
                }
            }
        }

        console.log(`✅ Hoàn tất. Đã tự động duyệt ${totalApproved} báo cáo trong các cụm đủ điều kiện.`);
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
