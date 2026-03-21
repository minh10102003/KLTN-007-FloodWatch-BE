const userRepository = require('../repositories/userRepository');
const userSessionRepository = require('../repositories/userSessionRepository');
const bcrypt = require('bcrypt');
const {
    getRefreshExpiresMs,
    hashRefreshToken,
    generateRefreshToken,
    signAccessToken,
    refreshHashesEqual
} = require('../services/tokenService');

/**
 * User Model
 * Sử dụng UserRepository để thực hiện các thao tác với database
 */
const userModel = {
    async _issueTokensForUser(user) {
        const refreshToken = generateRefreshToken();
        const refreshHash = hashRefreshToken(refreshToken);
        const expiresAt = new Date(Date.now() + getRefreshExpiresMs());
        const session = await userSessionRepository.createSession(user.id, refreshHash, expiresAt);
        const access_token = signAccessToken({
            id: user.id,
            username: user.username,
            role: user.role,
            sid: session.id
        });
        return {
            access_token,
            refresh_token: refreshToken,
            session_token: session.id,
            token: access_token
        };
    },

    /**
     * Đăng ký user mới
     */
    async register(userData) {
        const { username, email, password, full_name, phone } = userData;

        // Kiểm tra username đã tồn tại
        const existingUser = await userRepository.findByUsername(username);
        if (existingUser) {
            throw new Error('Username đã tồn tại');
        }

        // Kiểm tra email đã tồn tại
        const existingEmail = await userRepository.findByEmail(email);
        if (existingEmail) {
            throw new Error('Email đã tồn tại');
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Tạo user
        const user = await userRepository.createUser({
            username,
            email,
            password_hash,
            full_name,
            phone,
            role: 'user'
        });

        const tokens = await this._issueTokensForUser(user);
        return { user, ...tokens };
    },

    /**
     * Admin tạo tài khoản mới (user / moderator / admin)
     * Không trả token – người được tạo sẽ đăng nhập sau.
     */
    async createUserByAdmin(userData) {
        const { username, email, password, full_name, phone, role } = userData;
        const validRoles = ['user', 'moderator', 'admin'];
        if (!role || !validRoles.includes(role)) {
            throw new Error('Role không hợp lệ. Chọn: user, moderator, admin');
        }
        const existingUser = await userRepository.findByUsername(username);
        if (existingUser) throw new Error('Username đã tồn tại');
        const existingEmail = await userRepository.findByEmail(email);
        if (existingEmail) throw new Error('Email đã tồn tại');
        const password_hash = await bcrypt.hash(password, 10);
        const user = await userRepository.createUser({
            username,
            email,
            password_hash,
            full_name,
            phone,
            role
        });
        return user;
    },

    /**
     * Đăng nhập
     */
    async login(username, password) {
        const user = await userRepository.findByUsername(username);
        if (!user) {
            throw new Error('Username hoặc password không đúng');
        }

        if (!user.is_active) {
            throw new Error('Tài khoản đã bị vô hiệu hóa');
        }

        // Kiểm tra password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            throw new Error('Username hoặc password không đúng');
        }

        // Cập nhật last_login
        await userRepository.updateLastLogin(user.id);

        // Loại bỏ password_hash khỏi response
        delete user.password_hash;

        const tokens = await this._issueTokensForUser(user);
        return { user, ...tokens };
    },

    /**
     * Làm mới access JWT bằng refresh token + session_token (UUID phiên).
     * Refresh token được rotate mỗi lần gọi.
     */
    async refreshTokens(sessionToken, refreshTokenPlain) {
        if (!sessionToken || !refreshTokenPlain) {
            throw new Error('Thiếu session_token hoặc refresh_token');
        }
        const session = await userSessionRepository.findById(sessionToken);
        if (!session || session.revoked_at) {
            throw new Error('Phiên đăng nhập không hợp lệ');
        }
        if (new Date(session.expires_at) <= new Date()) {
            throw new Error('Refresh token đã hết hạn');
        }
        const incomingHash = hashRefreshToken(refreshTokenPlain);
        if (!refreshHashesEqual(session.refresh_token_hash, incomingHash)) {
            throw new Error('Refresh token không hợp lệ');
        }
        const user = await userRepository.findById(session.user_id);
        if (!user || !user.is_active) {
            throw new Error('Tài khoản không hợp lệ');
        }
        const newRefresh = generateRefreshToken();
        const newHash = hashRefreshToken(newRefresh);
        const expiresAt = new Date(Date.now() + getRefreshExpiresMs());
        const updated = await userSessionRepository.updateRefreshToken(sessionToken, newHash, expiresAt);
        if (!updated) {
            throw new Error('Phiên đăng nhập không hợp lệ');
        }
        const access_token = signAccessToken({
            id: user.id,
            username: user.username,
            role: user.role,
            sid: sessionToken
        });
        return {
            access_token,
            refresh_token: newRefresh,
            session_token: sessionToken,
            token: access_token
        };
    },

    /**
     * Lấy thông tin user
     */
    async getUserById(userId) {
        return await userRepository.findById(userId);
    },

    /**
     * Cập nhật profile
     */
    async updateProfile(userId, userData) {
        return await userRepository.updateUser(userId, userData);
    },

    /**
     * Đổi mật khẩu
     */
    async changePassword(userId, oldPassword, newPassword) {
        const user = await userRepository.findByUsername(
            (await userRepository.findById(userId)).username
        );

        // Kiểm tra password cũ
        const isValid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isValid) {
            throw new Error('Mật khẩu cũ không đúng');
        }

        // Hash password mới
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        const updated = await userRepository.changePassword(userId, newPasswordHash);
        await userSessionRepository.revokeAllForUser(userId);
        return updated;
    },

    /**
     * Phân quyền (chỉ admin)
     */
    async assignRole(userId, role) {
        return await userRepository.assignRole(userId, role);
    },

    /**
     * Kích hoạt/Vô hiệu hóa user (chỉ admin)
     */
    async setActiveStatus(userId, isActive) {
        return await userRepository.setActiveStatus(userId, isActive);
    },

    /**
     * Lấy danh sách users (chỉ admin)
     */
    async getAllUsers(limit, offset) {
        return await userRepository.getAllUsers(limit, offset);
    },

    /**
     * Đếm số admin (để validate không tự hạ role nếu chỉ còn 1 admin)
     * @param {number} [excludeUserId] - User ID loại trừ
     */
    async countAdmins(excludeUserId) {
        return await userRepository.countAdmins(excludeUserId);
    },

    /**
     * Lấy danh sách user đang online (is_online = true)
     */
    async getOnlineUsers() {
        return await userRepository.getOnlineUsers();
    },

    /**
     * Đăng xuất: thu hồi phiên (session) và set is_online = false
     * @param {number} userId - User ID
     * @param {string} [sessionId] - UUID phiên (từ JWT sid)
     */
    async logout(userId, sessionId) {
        if (sessionId) {
            await userSessionRepository.revokeSession(sessionId);
        }
        return await userRepository.setOnline(userId, false);
    },

    // ---------- Điểm tin cậy reporter (Cách C: A + B) ----------

    /** Hệ số delta Cách B: cross_verified +10, approved +3, rejected -8 hoặc -15 (spam/fake) */
    REPORTER_RELIABILITY_DELTAS: { cross_verified: 10, approved: 3, rejected: -8, rejected_severe: -15 },

    /**
     * Lấy điểm tin cậy reporter (0-100). Dùng khi tạo báo cáo mới.
     */
    async getReporterReliability(userId) {
        return await userRepository.getReporterReliability(userId);
    },

    /**
     * Cập nhật điểm tin cậy theo sự kiện (Cách B).
     * @param {number} userId - User ID (trong bảng users)
     * @param {'cross_verified'|'approved'|'rejected'} eventType
     * @param {string} [rejectionReason] - Lý do từ chối (để trừ nặng hơn nếu spam/fake)
     * @returns {Promise<number>} Điểm mới
     */
    async applyReporterReliabilityEvent(userId, eventType, rejectionReason = null) {
        const deltas = this.REPORTER_RELIABILITY_DELTAS;
        let delta = 0;
        if (eventType === 'cross_verified') delta = deltas.cross_verified;
        else if (eventType === 'approved') delta = deltas.approved;
        else if (eventType === 'rejected') {
            const reason = (rejectionReason || '').toLowerCase();
            const isSevere = /spam|fake|giả|sai\s*sự\s*thật/.test(reason);
            delta = isSevere ? deltas.rejected_severe : deltas.rejected;
        }
        if (delta === 0) return await userRepository.getReporterReliability(userId);
        return await userRepository.updateReporterReliabilityByDelta(userId, delta);
    },

    /**
     * Tính lại điểm tin cậy từ lịch sử (Cách A) và lưu vào users.reporter_reliability.
     * @param {number} userId - User ID (số). Trong crowd_reports reporter_id là string.
     */
    async recomputeReporterReliabilityFromHistory(userId) {
        const score = await userRepository.computeReporterReliabilityFromHistory(String(userId));
        return await userRepository.setReporterReliability(userId, score);
    }
};

module.exports = userModel;

