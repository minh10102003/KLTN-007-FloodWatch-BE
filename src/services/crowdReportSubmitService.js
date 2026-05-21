const crowdReportModel = require('../models/crowdReportModel');
const userModel = require('../models/userModel');
const { mapFloodLevel, VALID_LEVELS } = require('../utils/floodLevelMapper');
const { emitAdminNotification } = require('../socket/adminSocket');

/**
 * Tạo crowd report — dùng chung form API và chat agent confirm.
 */
async function submitCrowdReport({ user, body }) {
    const { name, level, lng, lat, photo_url, photo_urls, location_description, content } = body || {};

    if (!level || lng == null || lat == null) {
        const err = new Error('Thiếu thông tin bắt buộc: level, lng, lat');
        err.code = 'VALIDATION';
        throw err;
    }

    if (!user && !name) {
        const err = new Error(
            'Khách báo cáo cần nhập tên (name). Đăng nhập để không cần nhập tên.'
        );
        err.code = 'VALIDATION';
        throw err;
    }

    const levelNorm = mapFloodLevel(level);
    if (!levelNorm || !VALID_LEVELS.includes(levelNorm)) {
        const err = new Error('Mức độ ngập không hợp lệ. Chọn: Nhẹ, Trung bình, hoặc Nặng');
        err.code = 'VALIDATION';
        throw err;
    }

    const latN = Number(lat);
    const lngN = Number(lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
        const err = new Error('lat/lng không hợp lệ');
        err.code = 'VALIDATION';
        throw err;
    }

    const contentTrimmed = content != null && typeof content === 'string' ? content.trim() : '';
    if (contentTrimmed.length > 500) {
        const err = new Error('Nội dung mô tả tối đa 500 ký tự');
        err.code = 'VALIDATION';
        throw err;
    }

    const urlsArray = Array.isArray(photo_urls) ? photo_urls.filter((u) => u != null && String(u).trim()) : [];
    const photoUrlFinal = photo_url || urlsArray[0] || null;
    if (urlsArray.length > 5) {
        const err = new Error('Tối đa 5 ảnh cho mỗi báo cáo');
        err.code = 'VALIDATION';
        throw err;
    }

    const reporter_id = user ? String(user.id) : null;
    let reporter_name = name || '';
    if (user) {
        const u = await userModel.getUserById(user.id);
        reporter_name =
            u?.full_name && String(u.full_name).trim()
                ? String(u.full_name).trim()
                : u?.username || 'User';
    }

    const result = await crowdReportModel.createReport(
        reporter_name,
        reporter_id,
        levelNorm,
        lngN,
        latN,
        photoUrlFinal,
        location_description != null ? String(location_description).slice(0, 500) : null,
        contentTrimmed || null,
        urlsArray.length > 0 ? urlsArray : null
    );

    emitAdminNotification({
        type: 'report_pending',
        reportId: result.id
    });

    let message = 'Cảm ơn bạn đã báo cáo!';
    if (result.verified_by_sensor) {
        message = 'Báo cáo của bạn đã được xác minh bởi hệ thống cảm biến. Cảm ơn!';
    } else if (result.validation_status === 'pending') {
        message = 'Báo cáo của bạn đang được xem xét. Cảm ơn!';
    }

    return {
        message,
        data: {
            id: result.id,
            validation_status: result.validation_status,
            verified_by_sensor: result.verified_by_sensor,
            reporter_id
        }
    };
}

module.exports = { submitCrowdReport };
