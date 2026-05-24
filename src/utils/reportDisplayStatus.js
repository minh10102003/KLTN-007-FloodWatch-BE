/**
 * Nhãn hiển thị tách riêng: kiểm duyệt (moderation) vs xác minh chéo (validation).
 * Xác minh chéo KHÔNG thay thế duyệt moderator — luôn trả 2 chiều độc lập.
 */

function getModerationDisplay(report) {
    if (!report) {
        return { key: 'unknown', label: 'Không xác định' };
    }

    const status = report.moderation_status || report.status || 'pending';

    if (status === 'rejected') {
        return { key: 'rejected', label: 'Đã từ chối' };
    }
    if (status === 'approved') {
        if (report.auto_approved) {
            return { key: 'auto_approved', label: 'Tự động duyệt' };
        }
        return { key: 'approved', label: 'Đã duyệt' };
    }
  if (status === 'pending') {
        const nearby = Number(report.nearby_report_count) || 0;
        if (nearby > 0 && nearby < 5) {
            return {
                key: 'pending_near_auto',
                label: 'Chờ duyệt',
                hint: `Gần tự duyệt (${nearby}/5)`
            };
        }
        return { key: 'pending', label: 'Chờ duyệt' };
    }

    return { key: 'unknown', label: 'Không xác định' };
}

function getValidationDisplay(report) {
    if (!report) {
        return { key: 'unknown', label: 'Chưa xác minh chéo' };
    }

    const vs = report.validation_status || 'pending';

    if (vs === 'cross_verified') {
        return { key: 'cross_verified', label: 'Xác minh chéo' };
    }
    if (vs === 'verified') {
        return { key: 'verified', label: 'Đã xác minh' };
    }
    if (vs === 'rejected') {
        return { key: 'validation_rejected', label: 'Xác minh không đạt' };
    }

    return { key: 'validation_pending', label: 'Chưa xác minh chéo' };
}

function withReportDisplayStatus(data) {
    if (data == null) return data;

    const one = (r) => {
        if (!r || typeof r !== 'object') return r;
        return {
            ...r,
            display_moderation: getModerationDisplay(r),
            display_validation: getValidationDisplay(r)
        };
    };

    return Array.isArray(data) ? data.map(one) : one(data);
}

module.exports = {
    getModerationDisplay,
    getValidationDisplay,
    withReportDisplayStatus
};
