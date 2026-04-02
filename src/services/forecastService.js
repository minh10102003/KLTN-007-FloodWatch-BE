/**
 * Dự báo mực nước ngắn hạn từ chuỗi flood_logs (xu hướng tuyến tính đơn giản).
 */

function linearTrend(points) {
    const n = points.length;
    if (n === 0) {
        return { slopePerMin: 0, intercept: null };
    }
    if (n === 1) {
        return { slopePerMin: 0, intercept: points[0].level };
    }
    const t0 = points[0].tMin;
    let sumT = 0;
    let sumL = 0;
    let sumTT = 0;
    let sumTL = 0;
    for (const p of points) {
        const t = p.tMin - t0;
        const l = p.level;
        sumT += t;
        sumL += l;
        sumTT += t * t;
        sumTL += t * l;
    }
    const denom = n * sumTT - sumT * sumT;
    if (Math.abs(denom) < 1e-9) {
        return { slopePerMin: 0, intercept: sumL / n };
    }
    const slopePerMin = (n * sumTL - sumT * sumL) / denom;
    const intercept = (sumL - slopePerMin * sumT) / n;
    return { slopePerMin, intercept };
}

/**
 * @param {{ water_level: number, created_at: string|Date }[]} logs — ASC theo thời gian
 * @param {{ warning_threshold?: number, danger_threshold?: number }} thresholds
 * @param {number} horizonMinutes
 */
function buildForecast(logs, thresholds, horizonMinutes) {
    const warn = thresholds.warning_threshold != null ? Number(thresholds.warning_threshold) : 10;
    const danger = thresholds.danger_threshold != null ? Number(thresholds.danger_threshold) : 30;

    const points = (logs || [])
        .map((row) => {
            const level = row.water_level != null ? Number(row.water_level) : null;
            const created = row.created_at ? new Date(row.created_at) : null;
            if (level == null || !Number.isFinite(level) || !created || Number.isNaN(created.getTime())) {
                return null;
            }
            return { tMin: created.getTime() / 60000, level };
        })
        .filter(Boolean);

    const sampleCount = points.length;
    if (sampleCount === 0) {
        return {
            current_water_level_cm: null,
            velocity_cm_per_hour: null,
            predicted_water_level_cm: null,
            warning_threshold_cm: warn,
            danger_threshold_cm: danger,
            may_exceed_warning_within_horizon: false,
            may_exceed_danger_within_horizon: false,
            estimated_minutes_to_warning: null,
            estimated_minutes_to_danger: null,
            confidence: 'none',
            sample_count: 0,
            method: 'linear_trend',
            horizon_minutes: horizonMinutes
        };
    }

    const last = points[points.length - 1];
    const current = last.level;
    const { slopePerMin, intercept } = linearTrend(points);
    const velocityCmPerHour = Math.round(slopePerMin * 60 * 100) / 100;

    const lastT = last.tMin;
    const firstT = points[0].tMin;
    const spanMin = lastT - firstT;
    const futureT = lastT + horizonMinutes;
    const predicted =
        intercept != null && Number.isFinite(slopePerMin)
            ? intercept + slopePerMin * (futureT - points[0].tMin)
            : current;

    const predictedRounded = Math.round(predicted * 100) / 100;

    const minutesToReach = (targetCm) => {
        if (slopePerMin <= 0 || !Number.isFinite(slopePerMin)) return null;
        const delta = targetCm - current;
        if (delta <= 0) return 0;
        return Math.ceil(delta / slopePerMin);
    };

    const estWarn = minutesToReach(warn);
    const estDanger = minutesToReach(danger);

    let confidence = 'low';
    if (sampleCount >= 10 && spanMin >= 25) confidence = 'high';
    else if (sampleCount >= 4 && spanMin >= 10) confidence = 'medium';

    const mayExceedWarn =
        predictedRounded >= warn || (estWarn != null && estWarn <= horizonMinutes && estWarn >= 0);
    const mayExceedDanger =
        predictedRounded >= danger ||
        (estDanger != null && estDanger <= horizonMinutes && estDanger >= 0);

    return {
        current_water_level_cm: Math.round(current * 100) / 100,
        velocity_cm_per_hour: velocityCmPerHour,
        predicted_water_level_cm: predictedRounded,
        warning_threshold_cm: warn,
        danger_threshold_cm: danger,
        may_exceed_warning_within_horizon: Boolean(mayExceedWarn),
        may_exceed_danger_within_horizon: Boolean(mayExceedDanger),
        estimated_minutes_to_warning: estWarn,
        estimated_minutes_to_danger: estDanger,
        confidence,
        sample_count: sampleCount,
        span_minutes: Math.round(spanMin * 10) / 10,
        method: 'linear_trend',
        horizon_minutes: horizonMinutes
    };
}

module.exports = {
    linearTrend,
    buildForecast
};
