const fs = require('fs');
const path = require('path');
const userModel = require('../models/userModel');

/** Danh sách icon profile được phép (chỉ chọn từ folder public/profile-icons) */
function getAllowedProfileIcons() {
    const dir = path.join(__dirname, '../../public/profile-icons');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
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

            const result = await userModel.register({
                username,
                email,
                password,
                full_name,
                phone
            });

            res.status(201).json({
                success: true,
                message: 'Đăng ký thành công',
                data: result
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
                    error: 'Thiếu thông tin: username, password'
                });
            }

            const result = await userModel.login(username, password);

            res.json({
                success: true,
                message: 'Đăng nhập thành công',
                data: result
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
                data: user
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

    // Cập nhật profile (full_name, phone, email, avatar). Avatar chỉ được chọn từ danh sách icon có sẵn.
    updateProfile: async (req, res) => {
        try {
            const body = { ...req.body };
            if (body.avatar !== undefined) {
                const allowed = getAllowedProfileIcons();
                if (!allowed.includes(body.avatar)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Ảnh đại diện không hợp lệ. Chỉ được chọn từ danh sách icon có sẵn.'
                    });
                }
            }
            const user = await userModel.updateProfile(req.user.id, body);
            res.json({
                success: true,
                message: 'Cập nhật profile thành công',
                data: user
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    },

    // Đăng xuất (set is_online = false)
    logout: async (req, res) => {
        try {
            await userModel.logout(req.user.id);
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
            const user = await userModel.createUserByAdmin({
                username,
                email,
                password,
                full_name,
                phone,
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
            const status = err.message.includes('đã tồn tại') || err.message.includes('Role không hợp lệ') ? 400 : 500;
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
    }
};

module.exports = authController;

