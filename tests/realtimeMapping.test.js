/**
 * Kiểm thử chức năng 1.1 — Giám sát mực nước thời gian thực (Real-time Mapping).
 *
 * Nghiệp vụ: Trạm đo gửi MQTT → Server tính water_level + status → Bản đồ FE đổi màu.
 * Cách test:
 *   - Mô phỏng gói tin MQTT dạng raw_distance từ ESP32.
 *   - Đối chiếu status (normal/warning/danger) và **màu marker** (green/yellow/red)
 *     mà FE sẽ nhận sau khi Server xử lý.
 */
const {
    determineStatusFromLevel,
    colorForStatus,
    computeMapPointFromRaw,
} = require('../src/services/floodStatusService');

const THRESHOLDS_S01 = { warning_threshold: 10, danger_threshold: 30 };

describe('Real-time Mapping — đổi màu marker theo MQTT', () => {
    test('MQTT báo mực nước thấp → marker GIỮ MÀU XANH (normal)', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 95, // installation 100 → water_level = 5cm < warning 10
            installationHeight: 100,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(5);
        expect(point.status).toBe('normal');
        expect(point.color).toBe('green');
    });

    test('MQTT báo mực nước vượt ngưỡng warning → marker VÀNG', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 85, // → water_level = 15cm (10 ≤ 15 < 30)
            installationHeight: 100,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(15);
        expect(point.status).toBe('warning');
        expect(point.color).toBe('yellow');
    });

    test('MQTT báo ngập nặng → marker ĐỎ (đổi từ Xanh sang Đỏ)', () => {
        const before = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 95, // normal
            installationHeight: 100,
            thresholds: THRESHOLDS_S01,
        });
        const after = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 60, // → water_level = 40cm ≥ danger 30
            installationHeight: 100,
            thresholds: THRESHOLDS_S01,
        });
        expect(before.color).toBe('green');
        expect(after.water_level).toBe(40);
        expect(after.status).toBe('danger');
        expect(after.color).toBe('red');
    });

    test('Không có ngưỡng riêng → dùng default (warning=10, danger=30)', () => {
        expect(determineStatusFromLevel(5)).toBe('normal');
        expect(determineStatusFromLevel(15)).toBe('warning');
        expect(determineStatusFromLevel(35)).toBe('danger');
        expect(colorForStatus(determineStatusFromLevel(35))).toBe('red');
    });

    test('Mực nước không bao giờ âm khi raw_distance > installation_height', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 150,
            installationHeight: 100,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(0);
        expect(point.status).toBe('normal');
    });
});
