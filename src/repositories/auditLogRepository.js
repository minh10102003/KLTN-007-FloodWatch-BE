const BaseRepository = require('./baseRepository');

class AuditLogRepository extends BaseRepository {
    /**
     * Ghi một dòng audit
     * @param {number|null} userId - ID user thực hiện
     * @param {string} action - Ví dụ: sensor_threshold_updated, sensor_deleted, user_role_changed
     * @param {string} entityType - sensor | user
     * @param {string} entityId - sensor_id hoặc user id
     * @param {string} details - Mô tả chi tiết (optional)
     */
    async log(userId, action, entityType = null, entityId = null, details = null) {
        const query = `
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES ($1, $2, $3, $4, $5)
        `;
        await this.query(query, [userId || null, action, entityType, entityId ? String(entityId) : null, details]);
    }

    /**
     * Lấy danh sách audit log (Admin), có filter
     * @param {object} opts - { limit, offset, from, to, action, entityType }
     */
    async getLogs(opts = {}) {
        const limit = Math.min(parseInt(opts.limit, 10) || 100, 500);
        const offset = parseInt(opts.offset, 10) || 0;
        const from = opts.from || null;
        const to = opts.to || null;
        const action = opts.action || null;
        const entityType = opts.entityType || null;

        let query = `
            SELECT id, user_id, action, entity_type, entity_id, details, created_at
            FROM audit_logs
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;
        if (from) {
            query += ` AND created_at >= $${idx++}`;
            params.push(from);
        }
        if (to) {
            query += ` AND created_at <= $${idx++}`;
            params.push(to);
        }
        if (action) {
            query += ` AND action = $${idx++}`;
            params.push(action);
        }
        if (entityType) {
            query += ` AND entity_type = $${idx++}`;
            params.push(entityType);
        }
        query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
        params.push(limit, offset);
        return await this.queryAll(query, params);
    }
}

module.exports = new AuditLogRepository();
