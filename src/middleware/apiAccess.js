const { authenticate, optionalAuthenticate } = require('./auth');

function normalizePath(req) {
    const raw = req.originalUrl.split('?')[0];
    if (raw.length > 1 && raw.endsWith('/')) {
        return raw.slice(0, -1);
    }
    return raw;
}

/**
 * GET/HEAD đọc dữ liệu công khai (map, thời tiết, báo cáo đã public, v.v.) — không bắt buộc JWT.
 * Một số đường dẫn admin / moderation không mở cho khách.
 */
function isGuestReadableGet(path) {
    if (path.startsWith('/api/v1/admin/')) return false;
    if (path.startsWith('/api/audit-logs')) return false;

    if (path === '/api/sensors' || path.startsWith('/api/sensors/')) return true;

    const statsPublicExact = new Set([
        '/api/stats/online-count',
        '/api/stats/online-users/count',
        '/api/stats/monthly-visits'
    ]);
    if (statsPublicExact.has(path)) return true;

    if (path.startsWith('/api/crowd-reports/all')) return false;
    if (path === '/api/crowd-reports' || path.startsWith('/api/crowd-reports/')) return true;

    const prefixes = [
        '/api/v1/flood-data',
        '/api/flood-data',
        '/api/flood-history',
        '/api/v1/weather',
        '/api/v1/forecast',
        '/api/v1/fusion',
        '/api/v1/research',
        '/api/v1/routing/safe-path',
        '/api/v1/geocode',
        '/api/heatmap',
        '/api/report-evaluations',
        '/api/alerts'
    ];
    for (const p of prefixes) {
        if (path === p || path.startsWith(`${p}/`)) return true;
    }

    return false;
}

/**
 * POST/PUT phục vụ khách hoặc thiết bị không JWT (đã có kiểm tra khác trong controller / route).
 */
function isOptionalAuthWrite(method, path) {
    if (method === 'POST') {
        if (path === '/api/report-flood') return true;
        if (path === '/api/upload/report-image') return true;
        if (path === '/api/energy' || path === '/api/energy/') return true;
    }
    if (method === 'PUT' && /^\/api\/ota\/[^/]+\/status$/.test(path)) return true;
    return false;
}

function shouldUseOptionalAuth(req) {
    const path = normalizePath(req);
    const method = req.method;

    if (method === 'OPTIONS') return false;

    if (method === 'GET' || method === 'HEAD') {
        return isGuestReadableGet(path);
    }

    return isOptionalAuthWrite(method, path);
}

/**
 * Thay cho `authenticate` toàn cục trên `/api`:
 * - Đường đọc công khai + POST/PUT ẩn danh/sensor → optionalAuthenticate (có Bearer thì req.user, không thì null).
 * - Còn lại → authenticate (bắt buộc JWT hợp lệ).
 */
function apiAccess(req, res, next) {
    if (req.method === 'OPTIONS') {
        return next();
    }
    if (shouldUseOptionalAuth(req)) {
        return optionalAuthenticate(req, res, next);
    }
    return authenticate(req, res, next);
}

module.exports = {
    apiAccess,
    normalizePath,
    isGuestReadableGet,
    shouldUseOptionalAuth
};
