const jwt = require('jsonwebtoken');

/**
 * Kiểm tra user có role (hỗ trợ cả role đơn và mảng roles khi mở rộng).
 */
const hasRole = (user, roleName) => {
    if (!user) return false;
    if (Array.isArray(user.roles)) return user.roles.includes(roleName);
    return user.role === roleName;
};

/**
 * Middleware xác thực JWT
 */
const authenticate = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Token không được cung cấp'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: 'Token không hợp lệ hoặc đã hết hạn'
        });
    }
};

/**
 * Middleware: Chỉ Admin (Quản trị hạ tầng, người dùng, cấu hình hệ thống).
 * Admin mặc định KHÔNG có quyền Moderator (phân tách quyền RBAC).
 */
const requireAdmin = (req, res, next) => {
    if (!hasRole(req.user, 'admin')) {
        return res.status(403).json({
            success: false,
            error: 'Chỉ admin mới có quyền thực hiện thao tác này'
        });
    }
    next();
};

/**
 * Middleware: Chỉ Moderator (Kiểm duyệt nội dung, cảnh báo, thống kê nghiệp vụ).
 * Admin không kế thừa quyền moderator. Nếu cần cả hai, tài khoản phải có đồng thời 2 role.
 */
const requireModerator = (req, res, next) => {
    if (!hasRole(req.user, 'moderator')) {
        return res.status(403).json({
            success: false,
            error: 'Chỉ moderator mới có quyền thực hiện thao tác này'
        });
    }
    next();
};

/**
 * Middleware: Cho phép Admin hoặc Moderator (dùng cho endpoint cần cả hai role).
 */
const requireAdminOrModerator = (req, res, next) => {
    if (!hasRole(req.user, 'admin') && !hasRole(req.user, 'moderator')) {
        return res.status(403).json({
            success: false,
            error: 'Chỉ admin hoặc moderator mới có quyền thực hiện thao tác này'
        });
    }
    next();
};

/**
 * Middleware xác thực JWT (optional - không bắt buộc)
 * Nếu có token hợp lệ, set req.user; nếu không, req.user = null
 */
const optionalAuthenticate = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                req.user = decoded;
            } catch (err) {
                // Token không hợp lệ, nhưng không throw error (optional)
                req.user = null;
            }
        } else {
            req.user = null;
        }
        next();
    } catch (err) {
        req.user = null;
        next();
    }
};

module.exports = {
    authenticate,
    optionalAuthenticate,
    requireAdmin,
    requireModerator,
    requireAdminOrModerator
};

