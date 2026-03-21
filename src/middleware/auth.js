const { verifyAccessToken } = require('../services/tokenService');
const userSessionRepository = require('../repositories/userSessionRepository');

/**
 * Kiểm tra user có role (hỗ trợ cả role đơn và mảng roles khi mở rộng).
 */
const hasRole = (user, roleName) => {
    if (!user) return false;
    if (Array.isArray(user.roles)) return user.roles.includes(roleName);
    return user.role === roleName;
};

/**
 * Middleware: JWT access + phiên (user_sessions) còn hiệu lực
 */
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Token không được cung cấp'
            });
        }

        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch {
            return res.status(401).json({
                success: false,
                error: 'Token không hợp lệ hoặc đã hết hạn'
            });
        }

        if (decoded.typ !== 'access' || !decoded.sid) {
            return res.status(401).json({
                success: false,
                error: 'Token không hợp lệ'
            });
        }

        const active = await userSessionRepository.isSessionActive(decoded.sid, decoded.id);
        if (!active) {
            return res.status(401).json({
                success: false,
                error: 'Phiên đăng nhập đã hết hạn hoặc đã đăng xuất'
            });
        }

        req.user = decoded;
        next();
    } catch {
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
 * Middleware optional: access JWT + phiên hợp lệ thì set req.user, không thì null
 */
const optionalAuthenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

        if (!token) {
            req.user = null;
            return next();
        }

        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch {
            req.user = null;
            return next();
        }

        if (decoded.typ !== 'access' || !decoded.sid) {
            req.user = null;
            return next();
        }

        const active = await userSessionRepository.isSessionActive(decoded.sid, decoded.id);
        req.user = active ? decoded : null;
        next();
    } catch {
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

