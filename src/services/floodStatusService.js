/**
 * Helper thuần (không I/O) cho luồng giám sát mực nước thời gian thực.
 *
 * Dùng chung giữa pipeline MQTT runtime và unit test:
 *   - determineStatusFromLevel(level, thresholds)  → 'normal' | 'warning' | 'elevated' | 'danger' | 'critical'
 *   - colorForStatus(status)                       → màu hiển thị trên bản đồ FE
 *   - computeMapPointFromRaw({...})                → một bản ghi "điểm trên map"
 *
 * 5 mức cảnh báo theo bảng màu báo cáo ngập:
 *   Mức 1: < 10 cm  → normal   (xanh lá)
 *   Mức 2: 10–20 cm → warning  (vàng)
 *   Mức 3: 20–30 cm → elevated (cam)
 *   Mức 4: 30–50 cm → danger   (đỏ)
 *   Mức 5: ≥ 50 cm  → critical (đỏ sẫm)
 */

const DEFAULT_THRESHOLDS = Object.freeze({
    warning_threshold: 10,
    elevated_threshold: 20,
    danger_threshold: 30,
    critical_threshold: 50,
});

const STATUS_COLOR = Object.freeze({
    normal: '#4CAF50',
    warning: '#FFEB3B',
    elevated: '#FF9800',
    danger: '#F44336',
    critical: '#B71C1C',
});

function determineStatusFromLevel(waterLevel, thresholds) {
    const t = thresholds && typeof thresholds === 'object' ? thresholds : DEFAULT_THRESHOLDS;
    const warning = Number(t.warning_threshold ?? DEFAULT_THRESHOLDS.warning_threshold);
    const elevated = Number(t.elevated_threshold ?? DEFAULT_THRESHOLDS.elevated_threshold);
    const danger = Number(t.danger_threshold ?? DEFAULT_THRESHOLDS.danger_threshold);
    const critical = Number(t.critical_threshold ?? DEFAULT_THRESHOLDS.critical_threshold);
    const lvl = Number(waterLevel);
    if (!Number.isFinite(lvl)) return 'normal';
    if (lvl >= critical) return 'critical';
    if (lvl >= danger) return 'danger';
    if (lvl >= elevated) return 'elevated';
    if (lvl >= warning) return 'warning';
    return 'normal';
}

function colorForStatus(status) {
    return STATUS_COLOR[status] || STATUS_COLOR.normal;
}

/**
 * Mô phỏng pipeline MQTT: value (cm) hiển thị trực tiếp làm water_level.
 */
function computeMapPointFromRaw({ sensorId, rawDistance, thresholds }) {
    const d = Number(rawDistance);
    const wl = Number.isFinite(d) && d > 0 ? Math.round(d * 100) / 100 : 0;
    const status = determineStatusFromLevel(wl, thresholds);
    return {
        sensor_id: sensorId,
        water_level: wl,
        water_level_percent: null,
        zone: 'direct',
        status,
        color: colorForStatus(status)
    };
}

module.exports = {
    DEFAULT_THRESHOLDS,
    determineStatusFromLevel,
    colorForStatus,
    computeMapPointFromRaw,
};
