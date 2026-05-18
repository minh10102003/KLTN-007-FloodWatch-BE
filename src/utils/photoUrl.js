/**
 * Origin công khai để ghép URL ảnh (/uploads/...).
 * Ưu tiên PUBLIC_BASE_URL hoặc UPLOADS_PUBLIC_ORIGIN (không slash cuối).
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
 * @param {unknown} raw — JSONB / string / array từ pg
 * @returns {string[]}
 */
function normalizePhotoUrlsList(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) {
        return raw.filter((u) => u != null && String(u).trim()).map((u) => String(u).trim());
    }
    if (typeof raw === 'string') {
        const s = raw.trim();
        if (!s) return [];
        if (s.startsWith('[')) {
            try {
                const parsed = JSON.parse(s);
                return Array.isArray(parsed)
                    ? parsed.filter((u) => u != null && String(u).trim()).map((u) => String(u).trim())
                    : [];
            } catch {
                return [s];
            }
        }
        return [s];
    }
    return [];
}

/**
 * Luôn trỏ /uploads/* về PUBLIC_BASE_URL (sửa URL dev/Render nội bộ lưu trong DB).
 */
function toFullUrl(base, url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('/uploads/')) {
        return base + trimmed;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
            const u = new URL(trimmed);
            if (u.pathname.startsWith('/uploads/')) {
                return base + u.pathname;
            }
        } catch {
            return trimmed;
        }
        return trimmed;
    }

    if (trimmed.startsWith('uploads/')) {
        return `${base}/${trimmed}`;
    }

    return base + (trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
}

function toFullPhotoUrl(req, photoUrl) {
    if (!photoUrl || typeof photoUrl !== 'string') return photoUrl || null;
    return toFullUrl(getPublicBase(req), photoUrl);
}

/**
 * Gán photo_url + photo_urls (full URL) cho report / mảng reports.
 */
function withFullPhotoUrls(req, data) {
    if (!data) return data;
    const base = getPublicBase(req);
    const mapOne = (r) => {
        if (!r) return r;
        const urls = normalizePhotoUrlsList(r.photo_urls);
        const mappedUrls = urls.map((u) => toFullUrl(base, u)).filter(Boolean);
        let fullPhotoUrl = toFullUrl(base, r.photo_url);
        if (!fullPhotoUrl && mappedUrls.length > 0) {
            fullPhotoUrl = mappedUrls[0];
        }
        return {
            ...r,
            photo_url: fullPhotoUrl || null,
            photo_urls: mappedUrls.length > 0 ? mappedUrls : fullPhotoUrl ? [fullPhotoUrl] : []
        };
    };
    return Array.isArray(data) ? data.map(mapOne) : mapOne(data);
}

module.exports = {
    toFullPhotoUrl,
    withFullPhotoUrls,
    getPublicBase,
    toFullUrl,
    normalizePhotoUrlsList
};
