const BaseRepository = require('./baseRepository');

/**
 * Xóa dữ liệu cũ theo retention (giảm dung lượng / data transfer Neon).
 */
class DataRetentionRepository extends BaseRepository {
    async execute(sql, params = []) {
        const result = await this.pool.query(sql, params);
        return result.rowCount ?? 0;
    }

    async deleteOldFloodLogs(retentionHours, batchSize = 5000) {
        return this._deleteOlderThanBatched('flood_logs', retentionHours, batchSize);
    }

    async deleteOldEnergyLogs(retentionHours, batchSize = 5000) {
        return this._deleteOlderThanBatched('energy_logs', retentionHours, batchSize);
    }

    async deleteOldAccessLogs(retentionDays, batchSize = 5000) {
        const sql = `
            DELETE FROM access_logs
            WHERE id IN (
                SELECT id FROM access_logs
                WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')
                LIMIT $2
            )
        `;
        return this._deleteLoop(sql, [retentionDays, batchSize]);
    }

    async deleteOldEmergencyAlertSendLog(retentionHours, batchSize = 5000) {
        return this._deleteOlderThanBatched('emergency_alert_send_log', retentionHours, batchSize);
    }

    async _deleteOlderThanBatched(table, retentionHours, batchSize) {
        const sql = `
            DELETE FROM ${table}
            WHERE id IN (
                SELECT id FROM ${table}
                WHERE created_at < NOW() - ($1::int * INTERVAL '1 hour')
                LIMIT $2
            )
        `;
        return this._deleteLoop(sql, [retentionHours, batchSize]);
    }

    async _deleteLoop(sql, params) {
        let total = 0;
        for (let i = 0; i < 500; i++) {
            const n = await this.execute(sql, params);
            total += n;
            if (n < params[1]) break;
        }
        return total;
    }
}

module.exports = new DataRetentionRepository();
