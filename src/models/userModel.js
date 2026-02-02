const userRepository = require('../repositories/userRepository');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * User Model
 * Sử dụng UserRepository để thực hiện các thao tác với database
 */
const userModel = {
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

        // Tạo JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        return { user, token };
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

        // Tạo JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        // Loại bỏ password_hash khỏi response
        delete user.password_hash;

        return { user, token };
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

        return await userRepository.changePassword(userId, newPasswordHash);
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
    }
};

module.exports = userModel;

