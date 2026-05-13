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
 * Mô phỏng bước cuối của pipeline MQTT (sau Kalman + dist→water_level):
 *
 *     waterLevel = max(0, installationHeight - rawDistance)
 *     status     = determineStatusFromLevel(waterLevel, thresholds)
 *     color      = colorForStatus(status)
 *
 * Trả về object gọn để FE map dot/marker đổi màu.
 */
function computeMapPointFromRaw({ sensorId, rawDistance, installationHeight, thresholds }) {
    const wl = Math.max(0, Number(installationHeight) - Number(rawDistance));
    const status = determineStatusFromLevel(wl, thresholds);
    return {
        sensor_id: sensorId,
        water_level: wl,
        status,
        color: colorForStatus(status),
    };
}

module.exports = {
    DEFAULT_THRESHOLDS,
    determineStatusFromLevel,
    colorForStatus,
    computeMapPointFromRaw,
};
