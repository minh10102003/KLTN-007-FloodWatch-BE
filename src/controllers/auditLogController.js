const auditLogRepository = require('../repositories/auditLogRepository');

async function getAuditLogs(req, res) {
    try {
        const { limit, offset, from, to, action, entity_type } = req.query;
        const data = await auditLogRepository.getLogs({
            limit,
            offset,
            from,
            to,
            action,
            entityType: entity_type
        });
        return res.json({
            success: true,
            data
        });
    } catch (err) {
        console.error('getAuditLogs error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Lỗi khi lấy nhật ký hệ thống'
        });
    }
}

module.exports = {
    getAuditLogs
};
