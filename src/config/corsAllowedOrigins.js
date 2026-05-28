function parseCsv(raw) {
    if (!raw || typeof raw !== 'string') return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function isAllowedBySuffix(origin, suffixes) {
    try {
        const host = new URL(origin).hostname.toLowerCase();
        return suffixes.some((suffix) => {
            const s = String(suffix || '').toLowerCase();
            if (!s) return false;
            if (s.startsWith('.')) return host.endsWith(s);
            return host === s || host.endsWith(`.${s}`);
        });
    } catch {
        return false;
    }
}

const defaultCapacitorOrigins = [
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    'ionic://localhost'
];

const defaultDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8081',
    'http://127.0.0.1:8081'
];

const defaultProdOrigins = [
    'https://floodsight.id.vn',
    'https://www.floodsight.id.vn',
    'https://admin.floodsight.id.vn',
    'https://floodlight.id.vn',
    'https://www.floodlight.id.vn'
];

function buildAllowedOriginSet() {
    return new Set([
        ...defaultCapacitorOrigins,
        ...defaultDevOrigins,
        ...defaultProdOrigins,
        ...parseCsv(process.env.CORS_ALLOWED_ORIGINS),
        ...parseCsv(process.env.ADMIN_ORIGINS)
    ]);
}

const finalAllowedSuffixes = () => [
    '.vercel.app',
    ...parseCsv(process.env.CORS_ALLOWED_ORIGIN_SUFFIXES)
];

function isOriginAllowed(origin) {
    if (!origin) return true;
    const allowed = buildAllowedOriginSet();
    if (allowed.has(origin)) return true;
    return isAllowedBySuffix(origin, finalAllowedSuffixes());
}

function createCorsOriginCallback() {
    const logCorsBlocked = process.env.CORS_LOG_BLOCKED_ORIGINS === 'true';
    return function corsOrigin(origin, callback) {
        if (!origin) return callback(null, true);
        if (isOriginAllowed(origin)) return callback(null, true);
        if (logCorsBlocked) {
            console.warn('[CORS] blocked Origin (thêm vào CORS_ALLOWED_ORIGINS nếu hợp lệ):', origin);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    };
}

/** Danh sách origin tĩnh cho Socket.IO (polling preflight). */
function getSocketCorsOriginList() {
    return [...buildAllowedOriginSet()];
}

module.exports = {
    createCorsOriginCallback,
    getSocketCorsOriginList,
    isOriginAllowed
};
