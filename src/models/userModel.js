const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const userSessionRepository = require('../repositories/userSessionRepository');
const telegramLinkRepository = require('../repositories/telegramLinkRepository');
const otpService = require('../services/otpService');
const bcrypt = require('bcrypt');
const {
    getRefreshExpiresMs,
    getAccessExpiresInSeconds,
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
        const expires_in = getAccessExpiresInSeconds();
        return {
            access_token,
            refresh_token: refreshToken,
            session_token: session.id,
            token: access_token,
            expires_in,
            refresh_expires_at: expiresAt.toISOString()
        };
    },

    /**
     * Đăng ký user mới
     */
    async register(userData) {
        const { username, password, full_name, phone } = userData;
        const email = String(userData.email || '')
            .trim()
            .toLowerCase();
        if (!email) {
            throw new Error('Thiếu email');
        }

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

        const user = await userRepository.createUser({
            username,
            email,
            password_hash,
            full_name,
            phone,
            role: 'user',
            email_verified_at: null
        });

        try {
            await otpService.sendOtp(email);
        } catch (e) {
            await userRepository.deleteUserById(user.id);
            throw e;
        }

        return { user };
    },

    /**
     * Admin tạo tài khoản mới (user / moderator / admin)
     * Không trả token – người được tạo sẽ đăng nhập sau.
     */
    async createUserByAdmin(userData) {
        const { username, password, full_name, phone, role } = userData;
        const email = String(userData.email || '')
            .trim()
            .toLowerCase();
        if (!email) throw new Error('Thiếu email');
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
            role,
            email_verified_at: new Date()
        });
        return user;
    },

    /**
     * Đăng nhập (username hoặc email đã đăng ký + mật khẩu).
     */
    async login(username, password) {
        const raw = String(username || '').trim();
        if (!raw) {
            throw new Error('Username hoặc password không đúng');
        }

        let user = await userRepository.findByUsername(raw);
        if (!user) {
            user = await userRepository.findByEmail(raw.toLowerCase());
        }
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

        if (!user.email_verified_at) {
            throw new Error('Vui lòng xác minh email (mã OTP) trước khi đăng nhập');
        }

        // Cập nhật last_login
        await userRepository.updateLastLogin(user.id);

        // Loại bỏ password_hash khỏi response
        delete user.password_hash;

        const tokens = await this._issueTokensForUser(user);
        return { user, ...tokens };
    },

    /**
     * Đăng nhập / đăng ký lần đầu qua Google (email đã được Google xác minh).
     * User đã có cùng email → đăng nhập; chưa có → tạo user role `user`, email_verified_at = now.
     */
    async loginOrRegisterWithGoogle({ sub, email, name }) {
        const normalized = String(email || '')
            .trim()
            .toLowerCase();
        if (!normalized) {
            throw new Error('Thiếu email từ Google');
        }

        let row = await userRepository.findByEmail(normalized);
        if (row) {
            if (!row.is_active) {
                throw new Error('Tài khoản đã bị vô hiệu hóa');
            }
            if (!row.email_verified_at) {
                await userRepository.setEmailVerifiedAt(row.id, new Date());
            }
        } else {
            const username = await this._pickUniqueGoogleUsername(sub);
            const password_hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
            row = await userRepository.createUser({
                username,
                email: normalized,
                password_hash,
                full_name: (name && String(name).trim()) || normalized.split('@')[0] || username,
                phone: null,
                role: 'user',
                email_verified_at: new Date()
            });
        }

        await userRepository.updateLastLogin(row.id);
        const user = await userRepository.findById(row.id);
        if (!user || !user.is_active) {
            throw new Error('Tài khoản không hợp lệ');
        }

        const tokens = await this._issueTokensForUser(user);
        return { user, ...tokens };
    },

    /** Username duy nhất ≤ 50 ký tự (ràng buộc DB), từ Google `sub`. */
    async _pickUniqueGoogleUsername(sub) {
        const raw = String(sub || '').replace(/[^a-zA-Z0-9_]/g, '_');
        let base = (`g_${raw}` || 'g_user').slice(0, 50);
        let candidate = base;
        let n = 0;
        while (await userRepository.findByUsername(candidate)) {
            n += 1;
            const suffix = `_${n}`;
            candidate = (base.slice(0, Math.max(1, 50 - suffix.length)) + suffix).slice(0, 50);
        }
        return candidate;
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
        if (!user.email_verified_at) {
            throw new Error('Tài khoản chưa xác minh email');
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
        const expires_in = getAccessExpiresInSeconds();
        return {
            access_token,
            refresh_token: newRefresh,
            session_token: sessionToken,
            token: access_token,
            expires_in,
            refresh_expires_at: expiresAt.toISOString()
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
     * Lưu tọa độ GPS gần nhất (FE: Geolocation API sau khi user đồng ý).
     */
    async updateMyLocation(userId, payload) {
        return await userRepository.updateLastKnownLocation(userId, payload);
    },

    /**
     * Tạo deep link liên kết Telegram (t.me/bot?start=token), TTL ngắn.
     */
    async createTelegramDeepLink(userId) {
        const botUser = String(process.env.TELEGRAM_BOT_USERNAME || '')
            .trim()
            .replace(/^@/, '');
        const botTok = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
        if (!botUser) {
            throw new Error('Chưa cấu hình TELEGRAM_BOT_USERNAME (username bot, không gồm @)');
        }
        if (!botTok) {
            throw new Error('Chưa cấu hình TELEGRAM_BOT_TOKEN');
        }
        const ttl = Math.min(120, Math.max(5, parseInt(process.env.TELEGRAM_LINK_TTL_MINUTES || '15', 10)));
        await telegramLinkRepository.deletePendingForUser(userId);
        const raw = crypto.randomBytes(24).toString('hex').slice(0, 64);
        await telegramLinkRepository.createLinkToken(raw, userId, ttl);
        return {
            deep_link: `https://t.me/${botUser}?start=${raw}`,
            expires_in_minutes: ttl
        };
    },

    async getTelegramLinkStatus(userId) {
        const u = await userRepository.findById(userId);
        if (!u) throw new Error('Không tìm thấy user');
        return {
            telegram_linked: !!(u.telegram_chat_id && String(u.telegram_chat_id).trim()),
            telegram_username: u.telegram_username || null
        };
    },

    async unlinkTelegram(userId) {
        await telegramLinkRepository.deletePendingForUser(userId);
        await userRepository.clearTelegramChat(userId);
        return { ok: true };
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
     * Đặt mật khẩu mới sau khi xác thực OTP quên mật khẩu (purpose `password_reset`).
     */
    async resetPasswordWithOtp(email, otpCode, newPassword) {
        const pwd = String(newPassword || '');
        if (pwd.length < 6) {
            throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự');
        }

        const out = await otpService.verifyOtpForPurpose(
            email,
            otpCode,
            otpService.OTP_PURPOSE_PASSWORD_RESET
        );

        const user = await userRepository.findById(out.user_id);
        if (!user) throw new Error('Không tìm thấy tài khoản');
        if (!user.is_active) throw new Error('Tài khoản đã bị vô hiệu hóa');

        const newPasswordHash = await bcrypt.hash(pwd, 10);
        const updated = await userRepository.changePassword(user.id, newPasswordHash);
        await userSessionRepository.revokeAllForUser(user.id);
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
     * Xóa tài khoản (chỉ admin). Không cho xóa chính mình hoặc admin duy nhất.
     */
    async deleteUserByAdmin(requestingAdminId, targetUserId) {
        if (Number(targetUserId) === Number(requestingAdminId)) {
            throw new Error('Không thể xóa tài khoản của chính mình');
        }
        const target = await userRepository.findById(targetUserId);
        if (!target) {
            throw new Error('Không tìm thấy user');
        }
        if (target.role === 'admin') {
            const otherAdminCount = await userRepository.countAdmins(targetUserId);
            if (otherAdminCount < 1) {
                throw new Error('Không thể xóa admin duy nhất trong hệ thống');
            }
        }
        const deleted = await userRepository.deleteUserWithCleanup(targetUserId);
        if (!deleted) {
            throw new Error('Không tìm thấy user');
        }
        return deleted;
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
    },

    /**
     * Xác thực OTP email. Nếu purpose là đăng ký, ghi nhận email đã xác minh (sau đó user đăng nhập bình thường).
     */
    async verifyEmailWithOtp(email, code) {
        const out = await otpService.verifyOtp(email, code);
        const registrationCompleted = out.purpose === 'registration';
        if (registrationCompleted) {
            await userRepository.setEmailVerifiedAt(out.user_id);
        }
        return {
            verified: true,
            email: out.email,
            verified_at: out.verified_at,
            purpose: out.purpose,
            registration_completed: registrationCompleted
        };
    }
};

module.exports = userModel;

