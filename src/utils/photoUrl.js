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
    const base = req.protocol + '://' + (req.get('host') || '');
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
    const base = req.protocol + '://' + (req.get('host') || '');
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

module.exports = { toFullPhotoUrl, withFullPhotoUrls };
