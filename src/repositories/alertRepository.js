const BaseRepository = require('./baseRepository');

/**
 * Alert Repository
 * Chứa tất cả các query liên quan đến alerts
 */
class AlertRepository extends BaseRepository {
    /**
     * Tạo alert mới
     * @param {Object} alertData - Dữ liệu alert
     */
    async createAlert(alertData) {
        const {
            sensor_id,
            alert_type,
            severity = 'medium',
            message,
            water_level,
            velocity
        } = alertData;

        const query = `
            INSERT INTO alerts (sensor_id, alert_type, severity, message, water_level, velocity, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'active')
            RETURNING *
        `;
        return await this.queryOne(query, [sensor_id, alert_type, severity, message, water_level, velocity]);
    }

    /**
     * Lấy tất cả alerts
     * @param {Object} filters - Bộ lọc
     */
    async getAllAlerts(filters = {}) {
        const {
            status = null,
            severity = null,
            alert_type = null,
            sensor_id = null,
            limit = 100,
            offset = 0
        } = filters;

        let query = `
            SELECT 
                a.*,
                s.location_name,
                s.model,
                ST_X(s.coords::geometry) as lng,
                ST_Y(s.coords::geometry) as lat,
                u.username as acknowledged_by_username
            FROM alerts a
            LEFT JOIN sensors s ON a.sensor_id = s.sensor_id
            LEFT JOIN users u ON a.acknowledged_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND a.status = $${paramIndex++}`;
            params.push(status);
        }
        if (severity) {
            query += ` AND a.severity = $${paramIndex++}`;
            params.push(severity);
        }
        if (alert_type) {
            query += ` AND a.alert_type = $${paramIndex++}`;
            params.push(alert_type);
        }
        if (sensor_id) {
            query += ` AND a.sensor_id = $${paramIndex++}`;
            params.push(sensor_id);
        }

        query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        return await this.queryAll(query, params);
    }

    /**
     * Lấy alert theo ID
     * @param {number} alertId - Alert ID
     */
    async getAlertById(alertId) {
        const query = `
            SELECT 
                a.*,
                s.location_name,
                s.model,
                ST_X(s.coords::geometry) as lng,
                ST_Y(s.coords::geometry) as lat,
                u.username as acknowledged_by_username
            FROM alerts a
            LEFT JOIN sensors s ON a.sensor_id = s.sensor_id
            LEFT JOIN users u ON a.acknowledged_by = u.id
            WHERE a.id = $1
        `;
        return await this.queryOne(query, [alertId]);
    }

    /**
     * Acknowledge alert (xác nhận đã xem)
     * @param {number} alertId - Alert ID
     * @param {number} userId - User ID
     */
    async acknowledgeAlert(alertId, userId) {
        const query = `
            UPDATE alerts 
            SET status = 'acknowledged', 
                acknowledged_by = $1, 
                acknowledged_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;
        return await this.queryOne(query, [userId, alertId]);
    }

    /**
     * Resolve alert (đánh dấu đã xử lý)
     * @param {number} alertId - Alert ID
     */
    async resolveAlert(alertId) {
        const query = `
            UPDATE alerts 
            SET status = 'resolved', 
                resolved_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;
        return await this.queryOne(query, [alertId]);
    }

    /**
     * Lấy alerts chưa được acknowledge
     */
    async getActiveAlerts() {
        const query = `
            SELECT 
                a.*,
                s.location_name,
                s.model,
                ST_X(s.coords::geometry) as lng,
                ST_Y(s.coords::geometry) as lat
            FROM alerts a
            LEFT JOIN sensors s ON a.sensor_id = s.sensor_id
            WHERE a.status = 'active'
            ORDER BY 
                CASE a.severity 
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END,
                a.created_at DESC
        `;
        return await this.queryAll(query);
    }

    /**
     * Đếm số alerts theo trạng thái
     */
    async countAlertsByStatus() {
        const query = `
            SELECT status, COUNT(*) as count
            FROM alerts
            GROUP BY status
        `;
        return await this.queryAll(query);
    }
}

module.exports = new AlertRepository();

