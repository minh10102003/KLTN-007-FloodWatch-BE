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
            SELECT id, username, email, full_name, phone, role, is_active, last_login, created_at
            FROM users
            WHERE id = $1
        `;
        return await this.queryOne(query, [userId]);
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
            email
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
     * Cập nhật last_login
     * @param {number} userId - User ID
     */
    async updateLastLogin(userId) {
        const query = `
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP
            WHERE id = $1
        `;
        await this.query(query, [userId]);
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
            SELECT id, username, email, full_name, phone, role, is_active, last_login, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `;
        return await this.queryAll(query, [limit, offset]);
    }
}

module.exports = new UserRepository();

