const BaseRepository = require('./baseRepository');

/**
 * User Repository
 * Chứa tất cả các query liên quan đến users
 */
class UserRepository extends BaseRepository {
    /**
     * Tạo user mới
     * @param {Object} userData - Dữ liệu user
     */
    async createUser(userData) {
        const {
            username,
            email,
            password_hash,
            full_name,
            phone,
            role = 'user'
        } = userData;

        const query = `
            INSERT INTO users (username, email, password_hash, full_name, phone, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username, email, full_name, phone, role, is_active, created_at
        `;
        return await this.queryOne(query, [username, email, password_hash, full_name, phone, role]);
    }

    /**
     * Tìm user theo username
     * @param {string} username - Username
     */
    async findByUsername(username) {
        const query = `
            SELECT id, username, email, password_hash, full_name, phone, role, is_active, last_login, created_at
            FROM users
            WHERE username = $1
        `;
        return await this.queryOne(query, [username]);
    }

    /**
     * Tìm user theo email
     * @param {string} email - Email
     */
    async findByEmail(email) {
        const query = `
            SELECT id, username, email, password_hash, full_name, phone, role, is_active, last_login, created_at
            FROM users
            WHERE email = $1
        `;
        return await this.queryOne(query, [email]);
    }

    /**
     * Tìm user theo ID
     * @param {number} userId - User ID
     */
    async findById(userId) {
        const query = `
            SELECT id, username, email, full_name, phone, role, is_active, last_login, created_at, avatar
            FROM users
            WHERE id = $1
        `;
        return await this.queryOne(query, [userId]);
    }

    /**
     * Lấy điểm tin cậy reporter (0-100). Dùng khi tạo báo cáo mới.
     * @param {number} userId - User ID
     * @returns {Promise<number>}
     */
    async getReporterReliability(userId) {
        const query = `
            SELECT reporter_reliability FROM users WHERE id = $1
        `;
        const row = await this.queryOne(query, [userId]);
        const score = row?.reporter_reliability != null ? parseFloat(row.reporter_reliability) : 50;
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Cập nhật điểm tin cậy reporter theo delta (Cách B - sự kiện).
     * @param {number} userId - User ID
     * @param {number} delta - Số cộng/trừ (vd: +10, -8)
     * @returns {Promise<number>} Điểm mới (đã clamp 0-100)
     */
    async updateReporterReliabilityByDelta(userId, delta) {
        const current = await this.getReporterReliability(userId);
        const newScore = Math.max(0, Math.min(100, current + delta));
        await this.query(`
            UPDATE users SET reporter_reliability = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [newScore, userId]);
        return newScore;
    }

    /**
     * Gán trực tiếp điểm tin cậy reporter (dùng khi tính lại từ lịch sử - Cách A).
     * @param {number} userId - User ID
     * @param {number} score - Điểm 0-100
     */
    async setReporterReliability(userId, score) {
        const clamped = Math.max(0, Math.min(100, score));
        await this.query(`
            UPDATE users SET reporter_reliability = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [clamped, userId]);
        return clamped;
    }

    /**
     * Tính điểm tin cậy từ lịch sử (Cách A - thống kê).
     * Công thức: w1*approved_ratio*100 + w2*cross_verified_ratio*100 + w3*avg_community_rating/5*100
     * @param {string} reporterId - reporter_id (VARCHAR trong crowd_reports)
     * @param {object} weights - { w1, w2, w3 } mặc định 0.4, 0.4, 0.2
     * @returns {Promise<number>} Điểm 0-100, hoặc 50 nếu chưa có báo cáo
     */
    async computeReporterReliabilityFromHistory(reporterId, weights = { w1: 0.4, w2: 0.4, w3: 0.2 }) {
        const { w1, w2, w3 } = weights;
        const statsQuery = `
            SELECT 
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE moderation_status = 'approved')::int AS approved,
                COUNT(*) FILTER (WHERE moderation_status = 'rejected')::int AS rejected,
                COUNT(*) FILTER (WHERE verified_by_sensor = true)::int AS cross_verified
            FROM crowd_reports
            WHERE reporter_id = $1
        `;
        const stats = await this.queryOne(statsQuery, [String(reporterId)]);
        if (!stats || stats.total === 0) return 50;

        const total = stats.total;
        const moderated = stats.approved + stats.rejected;
        const approvedRatio = moderated > 0 ? stats.approved / moderated : 0.5;
        const crossVerifiedRatio = total > 0 ? stats.cross_verified / total : 0;

        const ratingQuery = `
            SELECT AVG(re.rating)::float AS avg_rating
            FROM report_evaluations re
            JOIN crowd_reports cr ON cr.id = re.report_id AND cr.reporter_id = $1
        `;
        const ratingRow = await this.queryOne(ratingQuery, [String(reporterId)]);
        const communityScore = ratingRow?.avg_rating != null ? (ratingRow.avg_rating / 5) * 100 : 50;

        const score = w1 * (approvedRatio * 100) + w2 * (crossVerifiedRatio * 100) + w3 * communityScore;
        return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
    }

    /**
     * Cập nhật thông tin user
     * @param {number} userId - User ID
     * @param {Object} userData - Dữ liệu cần cập nhật
     */
    async updateUser(userId, userData) {
        const {
            full_name,
            phone,
            email,
            avatar
        } = userData;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (full_name !== undefined) {
            updates.push(`full_name = $${paramIndex++}`);
            values.push(full_name);
        }
        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            values.push(phone);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramIndex++}`);
            values.push(email);
        }
        if (avatar !== undefined) {
            updates.push(`avatar = $${paramIndex++}`);
            values.push(avatar);
        }

        if (updates.length === 0) {
            return await this.findById(userId);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);

        await this.query(`
            UPDATE users 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
        `, values);

        return await this.findById(userId);
    }

    /**
     * Đổi mật khẩu
     * @param {number} userId - User ID
     * @param {string} newPasswordHash - Mật khẩu mới đã hash
     */
    async changePassword(userId, newPasswordHash) {
        const query = `
            UPDATE users 
            SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, username, email
        `;
        return await this.queryOne(query, [newPasswordHash, userId]);
    }

    /**
     * Cập nhật last_login và set is_online = true (khi đăng nhập)
     * @param {number} userId - User ID
     */
    async updateLastLogin(userId) {
        const query = `
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP, is_online = TRUE
            WHERE id = $1
        `;
        await this.query(query, [userId]);
    }

    /**
     * Set trạng thái is_online (true/false) - dùng khi đăng xuất
     * @param {number} userId - User ID
     * @param {boolean} isOnline - true = online, false = offline
     */
    async setOnline(userId, isOnline) {
        const query = `
            UPDATE users 
            SET is_online = $1
            WHERE id = $2
        `;
        await this.query(query, [isOnline, userId]);
    }

    /**
     * Phân quyền vai trò (chỉ admin)
     * @param {number} userId - User ID
     * @param {string} role - Vai trò mới
     */
    async assignRole(userId, role) {
        const query = `
            UPDATE users 
            SET role = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, username, email, role
        `;
        return await this.queryOne(query, [role, userId]);
    }

    /**
     * Kích hoạt/Vô hiệu hóa user
     * @param {number} userId - User ID
     * @param {boolean} isActive - Trạng thái
     */
    async setActiveStatus(userId, isActive) {
        const query = `
            UPDATE users 
            SET is_active = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, username, email, is_active
        `;
        return await this.queryOne(query, [isActive, userId]);
    }

    /**
     * Lấy danh sách users (cho admin)
     * @param {number} limit - Số lượng tối đa
     * @param {number} offset - Offset
     */
    async getAllUsers(limit = 100, offset = 0) {
        const query = `
            SELECT id, username, email, full_name, phone, role, is_active, last_login, created_at, reporter_reliability, avatar
            FROM users
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `;
        return await this.queryAll(query, [limit, offset]);
    }

    /**
     * Đếm số user có role admin (dùng khi validate không cho tự hạ role nếu chỉ còn 1 admin)
     * @param {number} excludeUserId - User ID loại trừ (vd: user đang tự đổi role)
     */
    async countAdmins(excludeUserId = null) {
        let query = `SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`;
        const params = [];
        if (excludeUserId != null) {
            query += ` AND id != $1`;
            params.push(excludeUserId);
        }
        const row = await this.queryOne(query, params);
        return row ? row.count : 0;
    }

    /**
     * Lấy danh sách user đang online (is_online = true, is_active = true)
     */
    async getOnlineUsers() {
        const query = `
            SELECT id, username, email, full_name, phone, role, last_login, is_online, avatar
            FROM users
            WHERE is_active = TRUE AND is_online = TRUE
            ORDER BY last_login DESC NULLS LAST
        `;
        return await this.queryAll(query, []);
    }
}

module.exports = new UserRepository();

