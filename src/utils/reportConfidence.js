/**
 * Điểm confidence (0–100) cho crowd_reports — tính khi trả API, không cần cột DB mới.
 * Kết hợp reliability_score, kiểm duyệt, validation, xác minh cảm biến, có ảnh minh chứng.
 */

function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}

/**
 * @param {object} r — row crowd_reports (đủ field thường có trong SELECT)
 * @returns {{ confidence: number, confidence_breakdown: object }}
 */
function computeReportConfidence(r) {
    if (!r) {
        return { confidence: 0, confidence_breakdown: {} };
    }

    let score = r.reliability_score != null ? Number(r.reliability_score) : 50;
    if (!Number.isFinite(score)) score = 50;

    const breakdown = { base_reliability: Math.round(score) };

    const hasPhoto =
        (r.photo_url && String(r.photo_url).trim()) ||
        (Array.isArray(r.photo_urls) && r.photo_urls.length > 0);
    if (hasPhoto) {
        score += 6;
        breakdown.photo_evidence = 6;
    }

    if (r.verified_by_sensor === true) {
        score += 14;
        breakdown.verified_by_sensor = 14;
    }

    const vs = r.validation_status;
    if (vs === 'cross_verified') {
        score += 10;
        breakdown.validation_cross_verified = 10;
    } else if (vs === 'verified') {
        score += 5;
        breakdown.validation_verified = 5;
    } else if (vs === 'rejected') {
        score -= 20;
        breakdown.validation_rejected = -20;
    }

    const ms = r.moderation_status;
    if (ms === 'approved') {
        score += 8;
        breakdown.moderation_approved = 8;
    } else if (ms === 'rejected') {
        score -= 28;
        breakdown.moderation_rejected = -28;
    } else if (ms === 'pending' || ms == null) {
        score -= 6;
        breakdown.moderation_pending = -6;
    }

    score = clamp(Math.round(score), 0, 100);
    return { confidence: score, confidence_breakdown: breakdown };
}

function withReportConfidence(data) {
    if (data == null) return data;
    const one = (r) => {
        if (!r || typeof r !== 'object') return r;
        const { confidence, confidence_breakdown } = computeReportConfidence(r);
        return { ...r, confidence, confidence_breakdown };
    };
    return Array.isArray(data) ? data.map(one) : one(data);
}

module.exports = {
    computeReportConfidence,
    withReportConfidence
};
