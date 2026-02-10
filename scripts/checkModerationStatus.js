const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'hcm_flood',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres'
});

async function checkModerationStatus() {
    try {
        console.log('🔍 Kiểm tra trạng thái moderation của các báo cáo...\n');

        // Lấy tất cả báo cáo
        const allReports = await pool.query(`
            SELECT 
                id,
                reporter_name,
                moderation_status,
                moderated_by,
                moderated_at,
                validation_status,
                created_at
            FROM crowd_reports
            ORDER BY created_at DESC
        `);

        console.log(`📊 Tổng số báo cáo: ${allReports.rows.length}\n`);

        // Phân loại theo moderation_status
        const pending = allReports.rows.filter(r => r.moderation_status === 'pending');
        const approved = allReports.rows.filter(r => r.moderation_status === 'approved');
        const rejected = allReports.rows.filter(r => r.moderation_status === 'rejected');
        const nullStatus = allReports.rows.filter(r => !r.moderation_status);

        console.log('📈 Thống kê:');
        console.log(`   - Pending: ${pending.length}`);
        console.log(`   - Approved: ${approved.length}`);
        console.log(`   - Rejected: ${rejected.length}`);
        console.log(`   - NULL: ${nullStatus.length}\n`);

        if (nullStatus.length > 0) {
            console.log('⚠️  Các báo cáo có moderation_status = NULL:');
            nullStatus.forEach(r => {
                console.log(`   - ID: ${r.id}, Name: ${r.reporter_name}, Created: ${r.created_at}`);
            });
            console.log('\n💡 Cần cập nhật các báo cáo này thành "pending":');
            console.log('   UPDATE crowd_reports SET moderation_status = \'pending\' WHERE moderation_status IS NULL;');
        }

        if (pending.length > 0) {
            console.log('\n⏳ Các báo cáo đang pending:');
            pending.forEach(r => {
                console.log(`   - ID: ${r.id}, Name: ${r.reporter_name}, Created: ${r.created_at}`);
            });
        }

        if (approved.length > 0) {
            console.log('\n✅ Các báo cáo đã approved:');
            approved.forEach(r => {
                console.log(`   - ID: ${r.id}, Name: ${r.reporter_name}, Moderated: ${r.moderated_at || 'N/A'}`);
            });
        }

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkModerationStatus();

