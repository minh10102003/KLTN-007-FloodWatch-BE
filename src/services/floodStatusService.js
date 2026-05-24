/**
 * Helper thuần (không I/O) cho luồng giám sát mực nước thời gian thực.
 *
 * Dùng chung giữa pipeline MQTT runtime và unit test:
 *   - determineStatusFromLevel(level, thresholds)  → 'normal' | 'warning' | 'danger'
 *   - colorForStatus(status)                       → màu hiển thị trên bản đồ FE
 *   - computeMapPointFromRaw({...})                → một bản ghi “điểm trên map”
 *
 * Quy ước ngưỡng: nếu sensor không có ngưỡng riêng (`thresholds` rỗng/null)
 * dùng mặc định: warning = 10 cm, danger = 30 cm — giống fallback trong
 * `mqttService.determineStatus`.
 */

const DEFAULT_THRESHOLDS = Object.freeze({
    warning_threshold: 10,
    danger_threshold: 30,
});

const STATUS_COLOR = Object.freeze({
    normal: 'green',
    warning: 'yellow',
    danger: 'red',
});

function determineStatusFromLevel(waterLevel, thresholds) {
    const t = thresholds && typeof thresholds === 'object' ? thresholds : DEFAULT_THRESHOLDS;
    const warning = Number(t.warning_threshold ?? DEFAULT_THRESHOLDS.warning_threshold);
    const danger = Number(t.danger_threshold ?? DEFAULT_THRESHOLDS.danger_threshold);
    const lvl = Number(waterLevel);
    if (!Number.isFinite(lvl)) return 'normal';
    if (lvl >= danger) return 'danger';
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
