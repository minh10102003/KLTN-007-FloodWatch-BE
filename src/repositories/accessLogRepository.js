const BaseRepository = require('./baseRepository');

class AccessLogRepository extends BaseRepository {
    /**
     * Ghi một lượt truy cập (gọi từ middleware)
     * @param {string} path - req.path
     */
    async log(path = '') {
        const query = `
            INSERT INTO access_logs (path) VALUES ($1)
        `;
        await this.query(query, [path.substring(0, 500)]);
    }

    /**
     * Đếm lượt truy cập trong một tháng
     * @param {number} year - Năm
     * @param {number} month - Tháng (1-12)
     */
    async getMonthlyCount(year, month) {
        const query = `
            SELECT COUNT(*)::int AS count
            FROM access_logs
            WHERE EXTRACT(YEAR FROM created_at) = $1
              AND EXTRACT(MONTH FROM created_at) = $2
        `;
        const row = await this.queryOne(query, [year, month]);
        return row ? row.count : 0;
    }
}

module.exports = new AccessLogRepository();
