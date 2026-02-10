const jwt = require('jsonwebtoken');

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
 * Middleware kiểm tra quyền admin
 */
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Chỉ admin mới có quyền thực hiện thao tác này'
        });
    }
    next();
};

/**
 * Middleware kiểm tra quyền admin hoặc moderator
 */
const requireModerator = (req, res, next) => {
    if (!['admin', 'moderator'].includes(req.user.role)) {
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
    requireModerator
};

