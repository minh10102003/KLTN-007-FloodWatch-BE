const express = require('express');
const multer = require('multer');
const path = require('path');
const uploadController = require('../controllers/uploadController');

const router = express.Router();

// Đảm bảo thư mục uploads tồn tại
uploadController.ensureUploadDir();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadController.UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = (path.extname(file.originalname) || '').toLowerCase() || '.jpg';
        const safeName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
        cb(null, safeName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: uploadController.MAX_SIZE },
    fileFilter: (req, file, cb) => {
        if (!uploadController.ALLOWED_MIMES.includes(file.mimetype)) {
            return cb(new Error('Chỉ chấp nhận ảnh: JPEG, PNG, GIF, WebP'), false);
        }
        cb(null, true);
    }
});

/**
 * POST /api/upload/report-image
 * Upload ảnh hiện trường cho báo cáo ngập.
 * Body: multipart/form-data, field name = "image"
 * Response: { success: true, url: "/uploads/xxx.jpg", filename: "xxx.jpg" }
 * FE dùng url (ghép với BASE_URL) gửi vào field photo_url khi POST /api/report-flood
 */
router.post('/upload/report-image', upload.single('image'), (req, res) => {
    uploadController.uploadReportImage(req, res);
}, (err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Kích thước ảnh tối đa 5MB.' });
    }
    res.status(400).json({ success: false, error: err.message || 'Lỗi upload ảnh.' });
});

module.exports = router;
