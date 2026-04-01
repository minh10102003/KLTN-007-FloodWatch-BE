/**
 * Origin công khai để ghép URL ảnh (/uploads/...).
 * Ưu tiên PUBLIC_BASE_URL hoặc UPLOADS_PUBLIC_ORIGIN (không slash cuối) — dùng khi CDN/proxy khác host.
 * Nếu không set: lấy từ request (cần trust proxy đằng sau Railway/nginx để https đúng).
 */
function getPublicBase(req) {
    const envBase = process.env.PUBLIC_BASE_URL || process.env.UPLOADS_PUBLIC_ORIGIN;
    if (envBase && String(envBase).trim()) {
        return String(envBase).trim().replace(/\/+$/, '');
    }
    const proto = req.protocol || 'http';
    const host = req.get('host') || '';
    return `${proto}://${host}`.replace(/\/+$/, '');
}

/**
 * Chuẩn hóa photo_url thành full URL để FE dùng trực tiếp <img src="..." />
 * Tránh lỗi 404 khi FE và API khác domain (browser request ảnh từ domain FE thay vì API).
 * @param {object} req - Express request (dùng req.protocol, req.get('host'))
 * @param {string|null} photoUrl - Giá trị photo_url từ DB (có thể relative /uploads/xxx hoặc đã full URL)
 * @returns {string|null} Full URL hoặc null
 */
function toFullPhotoUrl(req, photoUrl) {
    if (!photoUrl || typeof photoUrl !== 'string') return photoUrl || null;
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) return photoUrl;
    const base = getPublicBase(req);
    return base + (photoUrl.startsWith('/') ? photoUrl : '/' + photoUrl);
}

/**
 * Chuẩn hóa một URL (relative → full).
 */
function toFullUrl(base, url) {
    if (!url || typeof url !== 'string') return url || null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return base + (url.startsWith('/') ? url : '/' + url);
}

/**
 * Gán lại photo_url và photo_urls (full URL) cho một report hoặc mảng reports (không mutate bản gốc).
 */
function withFullPhotoUrls(req, data) {
    if (!data) return data;
    const base = getPublicBase(req);
    const mapOne = (r) => {
        if (!r) return r;
        const fullPhotoUrl = toFullUrl(base, r.photo_url) || r.photo_url;
        const fullPhotoUrls = Array.isArray(r.photo_urls) && r.photo_urls.length > 0
            ? r.photo_urls.map(u => toFullUrl(base, u))
            : (r.photo_urls || []);
        return { ...r, photo_url: fullPhotoUrl, photo_urls: fullPhotoUrls };
    };
    return Array.isArray(data) ? data.map(mapOne) : mapOne(data);
}

module.exports = { toFullPhotoUrl, withFullPhotoUrls, getPublicBase };
