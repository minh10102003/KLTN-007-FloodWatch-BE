const BaseRepository = require('./baseRepository');

class EmergencyAlertSendLogRepository extends BaseRepository {
    /**
     * Đã gửi thành công gần đây cho cùng sensor + user + loại cảnh báo?
     * @param {string} sensorId
     * @param {number} userId
     * @param {string} alertKind - ví dụ danger | warning_velocity
     * @param {number} cooldownMinutes
     */
    async wasSentRecently(sensorId, userId, alertKind, cooldownMinutes) {
        const mins = Math.max(1, Math.min(1440, parseInt(cooldownMinutes, 10) || 20));
        const row = await this.queryOne(
            `
            SELECT 1 AS yes
            FROM emergency_alert_send_log
            WHERE sensor_id = $1 AND user_id = $2 AND alert_kind = $3
              AND created_at > NOW() - ($4::int * INTERVAL '1 minute')
            LIMIT 1
            `,
            [sensorId, userId, String(alertKind), mins]
        );
        return !!row;
    }

    /**
     * Ghi sau khi ít nhất một kênh gửi thành công.
     */
    async recordSuccessfulSend(sensorId, userId, alertKind, channelsSummary) {
        await this.query(
            `
            INSERT INTO emergency_alert_send_log (sensor_id, user_id, alert_kind, channels_summary)
            VALUES ($1, $2, $3, $4)
            `,
            [sensorId, userId, String(alertKind), channelsSummary ? String(channelsSummary).slice(0, 2000) : null]
        );
    }

    /**
     * Thống kê nhanh cho admin (số lần gửi thành công đã ghi).
     */
    async getSummaryStats(hoursBack = 24) {
        const h = Math.max(1, Math.min(168, parseInt(hoursBack, 10) || 24));
        const byKind = await this.queryAll(
            `
            SELECT alert_kind, COUNT(*)::int AS send_count
            FROM emergency_alert_send_log
            WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')
            GROUP BY alert_kind
            ORDER BY send_count DESC
            `,
            [h]
        );
        const totalRow = await this.queryOne(
            `
            SELECT COUNT(*)::int AS total
            FROM emergency_alert_send_log
            WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')
            `,
            [h]
        );
        return { hours: h, total: totalRow ? totalRow.total : 0, by_alert_kind: byKind };
    }
}

module.exports = new EmergencyAlertSendLogRepository();
