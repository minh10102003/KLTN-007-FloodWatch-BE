const path = require('path');
const fs = require('fs');
const { getPublicBase } = require('../utils/photoUrl');

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function ensureUploadDir() {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
}

/**
 * Upload ảnh báo cáo ngập (multipart/form-data, field name: image)
 * Lưu vào /uploads, trả URL để FE lưu vào report (image_url / photo_url).
 */
const uploadReportImage = (req, res) => {
    ensureUploadDir();
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'Thiếu file ảnh. Gửi với field name "image" (multipart/form-data).'
        });
    }
    const url = '/uploads/' + req.file.filename;
    const base = getPublicBase(req);
    const absolute_url = base + url;
    res.json({
        success: true,
        url,
        absolute_url,
        filename: req.file.filename
    });
};

module.exports = {
    uploadReportImage,
    UPLOAD_DIR,
    ALLOWED_MIMES,
    MAX_SIZE,
    ensureUploadDir
};
