const userModel = require('../models/userModel');

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

    // Cập nhật profile
    updateProfile: async (req, res) => {
        try {
            const user = await userModel.updateProfile(req.user.id, req.body);
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
    }
};

module.exports = authController;

