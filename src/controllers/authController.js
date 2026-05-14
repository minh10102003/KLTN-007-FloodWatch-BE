const fs = require('fs');
const path = require('path');
const userModel = require('../models/userModel');
const otpService = require('../services/otpService');
const userContactValidation = require('../utils/userContactValidation');

/** Danh sách icon profile được phép (chỉ chọn từ folder public/profile-icons) */
function getAllowedProfileIcons() {
    const dir = path.join(__dirname, '../../public/profile-icons');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
}

/** Không trả `telegram_chat_id` ra JSON; thêm cờ `telegram_linked`. */
function toPublicProfileUser(user) {
    if (!user) return user;
    const { telegram_chat_id, ...rest } = user;
    return {
        ...rest,
        telegram_linked: !!(telegram_chat_id && String(telegram_chat_id).trim())
    };
}

const authController = {
    // Đăng ký
    register: async (req, res) => {
        try {
            const { username, email, password, full_name, phone } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin bắt buộc: username, email, password'
                });
            }
            if (full_name === undefined || full_name === null || String(full_name).trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu họ và tên (full_name).',
                    details: { full_name: 'Bắt buộc.' }
                });
            }
            if (phone === undefined || phone === null || String(phone).trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu số điện thoại (phone).',
                    details: { phone: 'Bắt buộc.' }
                });
            }

            const core = userContactValidation.validateUserCoreContact({ full_name, email, phone });
            if (!core.ok) {
                return res.status(400).json({
                    success: false,
                    error: core.error,
                    details: core.details
                });
            }

            const result = await userModel.register({
                username,
                email: core.values.email,
                password,
                full_name: core.values.full_name,
                phone: core.values.phone
            });

            res.status(201).json({
                success: true,
                message:
                    'Đăng ký thành công. Kiểm tra email và nhập mã OTP để xác minh, sau đó mới đăng nhập được.',
                data: {
                    user: result.user
                }
            });
        } catch (err) {
            res.status(400).json({
                success: false,
                error: err.message
            });
        }
    },

    // Đăng nhập
    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: username (hoặc email), password'
                });
            }

            const result = await userModel.login(username, password);

            res.json({
                success: true,
                message: 'Đăng nhập thành công',
                data: {
                    user: result.user,
                    access_token: result.access_token,
                    refresh_token: result.refresh_token,
                    session_token: result.session_token,
                    token: result.token,
                    expires_in: result.expires_in,
                    refresh_expires_at: result.refresh_expires_at
                }
            });
        } catch (err) {
            const needVerify = /xác minh email/i.test(err.message);
            res.status(needVerify ? 403 : 401).json({
                success: false,
                error: err.message
            });
        }
    },

    /**
     * Làm mới access JWT (body: refresh_token, session_token). Refresh token rotate mỗi lần.
     */
    refresh: async (req, res) => {
        try {
            const { refresh_token, session_token } = req.body;
            const tokens = await userModel.refreshTokens(session_token, refresh_token);
            res.json({
                success: true,
                message: 'Làm mới token thành công',
                data: {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    session_token: tokens.session_token,
                    token: tokens.token,
                    expires_in: tokens.expires_in,
                    refresh_expires_at: tokens.refresh_expires_at
                }
            });
        } catch (err) {
            res.status(401).json({
                success: false,
                error: err.message
            });
        }
    },

    // Lấy thông tin user hiện tại
    getProfile: async (req, res) => {
        try {
            const user = await userModel.getUserById(req.user.id);
            res.json({
                success: true,
                data: toPublicProfileUser(user)
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },

    /**
     * Lấy danh sách icon profile có thể chọn (chỉ icon trong folder, không tải ảnh từ máy)
     */
    getProfileIcons: async (req, res) => {
        try {
            const icons = getAllowedProfileIcons();
            const baseUrl = '/profile-icons';
            res.json({
                success: true,
                data: icons.map(name => ({ name, url: `${baseUrl}/${name}` }))
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err.message || 'Lỗi khi lấy danh sách icon'
            });
        }
    },

    /**
     * Cập nhật vị trí hiện tại (GPS). FE gọi sau navigator.geolocation.getCurrentPosition khi user đã đăng nhập.
     * Body: { lat, lng, accuracy_m? } (WGS84).
     */
    updateMyLocation: async (req, res) => {
        try {
            const { lat, lng, accuracy_m } = req.body;
            if (lat == null || lng == null) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu lat hoặc lng (độ WGS84, số thực)'
                });
            }
            const la = Number(lat);
            const ln = Number(lng);
            if (!Number.isFinite(la) || !Number.isFinite(ln)) {
                return res.status(400).json({ success: false, error: 'lat/lng phải là số' });
            }
            if (la < -90 || la > 90 || ln < -180 || ln > 180) {
                return res.status(400).json({ success: false, error: 'lat ∈ [-90,90], lng ∈ [-180,180]' });
            }
            let acc = null;
            if (accuracy_m != null && accuracy_m !== '') {
                acc = Number(accuracy_m);
                if (!Number.isFinite(acc) || acc < 0 || acc > 500_000) {
                    return res.status(400).json({ success: false, error: 'accuracy_m không hợp lệ' });
                }
            }
            const user = await userModel.updateMyLocation(req.user.id, { lat: la, lng: ln, accuracy_m: acc });
            res.json({
                success: true,
                message: 'Đã cập nhật vị trí',
                data: {
                    last_known_lat: user.last_known_lat != null ? parseFloat(user.last_known_lat) : null,
                    last_known_lng: user.last_known_lng != null ? parseFloat(user.last_known_lng) : null,
                    last_location_accuracy_m:
                        user.last_location_accuracy_m != null
                            ? parseFloat(user.last_location_accuracy_m)
                            : null,
                    last_location_at: user.last_location_at
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Cập nhật profile: mỗi lần gửi đủ full_name (hoặc fullName), email, phone; avatar tuỳ chọn.
    updateProfile: async (req, res) => {
        try {
            const body = { ...req.body };
            const hasName = body.full_name !== undefined || body.fullName !== undefined;
            const hasEmail = body.email !== undefined;
            const hasPhone = body.phone !== undefined;
            if (!hasName || !hasEmail || !hasPhone) {
                return res.status(400).json({
                    success: false,
                    error: 'Cần gửi đủ full_name (hoặc fullName), email, phone mỗi lần cập nhật profile.',
                    details: {
                        ...(!hasName ? { full_name: 'Bắt buộc.' } : {}),
                        ...(!hasEmail ? { email: 'Bắt buộc.' } : {}),
                        ...(!hasPhone ? { phone: 'Bắt buộc.' } : {})
                    }
                });
            }

            const rawName = body.full_name !== undefined ? body.full_name : body.fullName;
            const core = userContactValidation.validateUserCoreContact({
                full_name: rawName,
                email: body.email,
                phone: body.phone
            });
            if (!core.ok) {
                return res.status(400).json({
                    success: false,
                    error: core.error,
                    details: core.details
                });
            }

            const taken = await userModel.isEmailUsedByOther(core.values.email, req.user.id);
            if (taken) {
                return res.status(400).json({
                    success: false,
                    error: 'Email này đã được tài khoản khác sử dụng.',
                    details: { email: 'Trùng email.' }
                });
            }

            const payload = {
                full_name: core.values.full_name,
                email: core.values.email,
                phone: core.values.phone
            };
            if (body.avatar !== undefined) {
                const allowed = getAllowedProfileIcons();
                if (!allowed.includes(body.avatar)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Ảnh đại diện không hợp lệ. Chỉ được chọn từ danh sách icon có sẵn.'
                    });
                }
                payload.avatar = body.avatar;
            }

            await userModel.updateProfile(req.user.id, payload);
            const fresh = await userModel.getUserById(req.user.id);
            if (!fresh) {
                return res.status(500).json({
                    success: false,
                    error: 'Không đọc lại được dữ liệu user sau khi cập nhật'
                });
            }
            res.json({
                success: true,
                message: 'Cập nhật profile thành công',
                data: toPublicProfileUser(fresh)
            });
        } catch (err) {
            if (err.code === '23505') {
                return res.status(400).json({
                    success: false,
                    error: 'Email đã tồn tại hoặc vi phạm ràng buộc duy nhất.',
                    details: { email: 'Trùng hoặc không hợp lệ.' }
                });
            }
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },

    // Đăng xuất (thu hồi phiên + set is_online = false)
    logout: async (req, res) => {
        try {
            await userModel.logout(req.user.id, req.user.sid);
            res.json({
                success: true,
                message: 'Đăng xuất thành công'
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err.message || 'Lỗi khi đăng xuất'
            });
        }
    },

    // Đổi mật khẩu
    changePassword: async (req, res) => {
        try {
            const { old_password, new_password } = req.body;

            if (!old_password || !new_password) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: old_password, new_password'
                });
            }

            await userModel.changePassword(req.user.id, old_password, new_password);

            res.json({
                success: true,
                message: 'Đổi mật khẩu thành công'
            });
        } catch (err) {
            res.status(400).json({
                success: false,
                error: err.message
            });
        }
    },

    // Gửi OTP qua email
    sendOtp: async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: email'
                });
            }
            const data = await otpService.sendOtp(email);
            res.status(201).json({
                success: true,
                message: 'Đã gửi OTP qua email',
                data
            });
        } catch (err) {
            const status = /thiếu|chờ|quá số lần|hết hạn|không chính xác|chưa được đăng ký|vô hiệu hóa/i.test(err.message)
                ? 400
                : 500;
            res.status(status).json({
                success: false,
                error: err.message
            });
        }
    },

    // Gửi lại OTP qua email
    resendOtp: async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: email'
                });
            }
            const data = await otpService.resendOtp(email);
            res.status(201).json({
                success: true,
                message: 'Đã gửi lại OTP qua email',
                data
            });
        } catch (err) {
            const status = /thiếu|chờ|quá số lần|hết hạn|không chính xác|chưa được đăng ký|vô hiệu hóa/i.test(err.message)
                ? 400
                : 500;
            res.status(status).json({
                success: false,
                error: err.message
            });
        }
    },

    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: email'
                });
            }
            const data = await otpService.sendForgotPasswordOtp(email);
            res.status(201).json({
                success: true,
                message: 'Đã gửi OTP đặt lại mật khẩu qua email',
                data
            });
        } catch (err) {
            const status = /thiếu|chờ|quá số lần|chưa được đăng ký|vô hiệu hóa|xác minh email trước/i.test(
                err.message
            )
                ? 400
                : 500;
            res.status(status).json({
                success: false,
                error: err.message
            });
        }
    },

    resetPassword: async (req, res) => {
        try {
            const { email, otp_code, new_password } = req.body;
            if (!email || !otp_code || !new_password) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: email, otp_code, new_password'
                });
            }
            await userModel.resetPasswordWithOtp(email, otp_code, new_password);
            res.json({
                success: true,
                message: 'Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.'
            });
        } catch (err) {
            const status = /thiếu|hết hạn|không chính xác|không tồn tại|ít nhất 6/i.test(err.message)
                ? 400
                : 500;
            res.status(status).json({
                success: false,
                error: err.message
            });
        }
    },

    // Xác thực OTP
    verifyOtp: async (req, res) => {
        try {
            const { email, otp_code } = req.body;
            if (!email || !otp_code) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin: email, otp_code'
                });
            }
            const data = await userModel.verifyEmailWithOtp(email, otp_code);
            res.json({
                success: true,
                message: data.registration_completed
                    ? 'Đã xác minh email. Bạn có thể đăng nhập.'
                    : 'Xác thực OTP thành công',
                data
            });
        } catch (err) {
            const status = /thiếu|hết hạn|không chính xác|không tồn tại/i.test(err.message) ? 400 : 500;
            res.status(status).json({
                success: false,
                error: err.message
            });
        }
    },

    // ========== Chỉ Admin ==========

    /**
     * Lấy danh sách users (chỉ admin)
     * Query: limit, offset
     */
    getAllUsers: async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
            const offset = parseInt(req.query.offset, 10) || 0;
            const users = await userModel.getAllUsers(limit, offset);
            res.json({
                success: true,
                data: users
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err.message || 'Lỗi khi lấy danh sách user'
            });
        }
    },

    /**
     * Admin tạo tài khoản mới (user, moderator hoặc admin)
     * Body: username, email, password, role (bắt buộc), full_name?, phone?
     */
    createUser: async (req, res) => {
        try {
            const { username, email, password, full_name, phone, role } = req.body;
            if (!username || !email || !password || !role) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin bắt buộc: username, email, password, role'
                });
            }
            if (full_name === undefined || full_name === null || String(full_name).trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu họ và tên (full_name).',
                    details: { full_name: 'Bắt buộc.' }
                });
            }
            if (phone === undefined || phone === null || String(phone).trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu số điện thoại (phone).',
                    details: { phone: 'Bắt buộc.' }
                });
            }

            const core = userContactValidation.validateUserCoreContact({ full_name, email, phone });
            if (!core.ok) {
                return res.status(400).json({
                    success: false,
                    error: core.error,
                    details: core.details
                });
            }

            const user = await userModel.createUserByAdmin({
                username,
                email: core.values.email,
                password,
                full_name: core.values.full_name,
                phone: core.values.phone,
                role
            });
            const auditLogRepository = require('../repositories/auditLogRepository');
            await auditLogRepository.log(req.user.id, 'user_created', 'user', String(user.id), `role=${user.role}`);
            res.status(201).json({
                success: true,
                message: 'Tạo tài khoản thành công',
                data: user
            });
        } catch (err) {
            if (err.code === '23505') {
                return res.status(400).json({
                    success: false,
                    error: 'Email hoặc dữ liệu trùng ràng buộc duy nhất trên hệ thống.',
                    details: { email: 'Có thể trùng email.' }
                });
            }
            const status =
                err.message.includes('đã tồn tại') ||
                err.message.includes('Role không hợp lệ') ||
                err.message.includes('Thiếu')
                    ? 400
                    : 500;
            res.status(status).json({
                success: false,
                error: err.message
            });
        }
    },

    /**
     * Gán role cho user (chỉ admin).
     * Không cho admin tự hạ role của chính mình nếu hệ thống chỉ còn 1 admin.
     */
    assignRole: async (req, res) => {
        try {
            const userId = parseInt(req.params.userId, 10);
            const { role } = req.body;

            const validRoles = ['user', 'moderator', 'admin'];
            if (!role || !validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    error: 'Role không hợp lệ. Chọn: user, moderator, admin'
                });
            }

            const targetUser = await userModel.getUserById(userId);
            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy user'
                });
            }

            const currentUserId = req.user.id;
            if (userId === currentUserId && role !== 'admin') {
                const adminCount = await userModel.countAdmins(currentUserId);
                if (adminCount < 1) {
                    return res.status(400).json({
                        success: false,
                        error: 'Không thể tự hạ quyền vì bạn là admin duy nhất. Cần ít nhất một admin trong hệ thống.'
                    });
                }
            }

            const updated = await userModel.assignRole(userId, role);
            const auditLogRepository = require('../repositories/auditLogRepository');
            await auditLogRepository.log(req.user.id, 'user_role_changed', 'user', String(userId), `role=${role}`);
            res.json({
                success: true,
                message: 'Cập nhật role thành công',
                data: updated
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err.message || 'Lỗi khi cập nhật role'
            });
        }
    },

    /**
     * Xóa tài khoản user (chỉ admin)
     */
    deleteUser: async (req, res) => {
        try {
            const userId = parseInt(req.params.userId, 10);
            if (isNaN(userId)) {
                return res.status(400).json({ success: false, error: 'userId không hợp lệ' });
            }
            const deleted = await userModel.deleteUserByAdmin(req.user.id, userId);
            const auditLogRepository = require('../repositories/auditLogRepository');
            await auditLogRepository.log(req.user.id, 'user_deleted', 'user', String(userId), `username=${deleted.username}`);
            res.json({
                success: true,
                message: 'Đã xóa tài khoản',
                data: deleted
            });
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('Không tìm thấy')) {
                return res.status(404).json({ success: false, error: msg });
            }
            if (
                msg.includes('Không thể xóa') ||
                msg.includes('chính mình') ||
                msg.includes('admin duy nhất')
            ) {
                return res.status(400).json({ success: false, error: msg });
            }
            res.status(500).json({
                success: false,
                error: msg || 'Lỗi khi xóa tài khoản'
            });
        }
    },

    /**
     * Bật/tắt tài khoản user (chỉ admin)
     */
    setActiveStatus: async (req, res) => {
        try {
            const userId = parseInt(req.params.userId, 10);
            const { is_active } = req.body;

            if (typeof is_active !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    error: 'Cần truyền is_active (boolean)'
                });
            }

            const targetUser = await userModel.getUserById(userId);
            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy user'
                });
            }

            const updated = await userModel.setActiveStatus(userId, is_active);
            const auditLogRepository = require('../repositories/auditLogRepository');
            await auditLogRepository.log(req.user.id, 'user_active_changed', 'user', String(userId), `is_active=${is_active}`);
            res.json({
                success: true,
                message: is_active ? 'Đã kích hoạt tài khoản' : 'Đã vô hiệu hóa tài khoản',
                data: updated
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err.message || 'Lỗi khi cập nhật trạng thái tài khoản'
            });
        }
    },

    /**
     * Tính lại điểm tin cậy reporter từ lịch sử (Cách A) và lưu vào users.reporter_reliability. Chỉ admin.
     */
    recomputeReporterReliability: async (req, res) => {
        try {
            const userId = parseInt(req.params.userId, 10);
            if (isNaN(userId)) {
                return res.status(400).json({ success: false, error: 'userId không hợp lệ' });
            }
            const user = await userModel.getUserById(userId);
            if (!user) {
                return res.status(404).json({ success: false, error: 'Không tìm thấy user' });
            }
            const newScore = await userModel.recomputeReporterReliabilityFromHistory(userId);
            res.json({
                success: true,
                message: 'Đã tính lại điểm tin cậy từ lịch sử',
                data: { userId, reporter_reliability: newScore }
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err.message || 'Lỗi khi tính lại điểm tin cậy'
            });
        }
    },

    /** Tạo deep link `t.me/<bot>?start=<token>` để user mở Telegram và liên kết chat riêng. */
    createTelegramLink: async (req, res) => {
        try {
            const data = await userModel.createTelegramDeepLink(req.user.id);
            res.json({ success: true, data });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    },

    getTelegramStatus: async (req, res) => {
        try {
            const data = await userModel.getTelegramLinkStatus(req.user.id);
            res.json({ success: true, data });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    unlinkTelegram: async (req, res) => {
        try {
            await userModel.unlinkTelegram(req.user.id);
            res.json({ success: true, message: 'Đã gỡ liên kết Telegram' });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = authController;

