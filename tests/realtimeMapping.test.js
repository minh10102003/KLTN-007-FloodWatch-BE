/**
 * Kiểm thử chức năng 1.1 — Giám sát mực nước thời gian thực (Real-time Mapping).
 *
 * Nghiệp vụ: value MQTT (cm) = water_level hiển thị FE; so ngưỡng warning/danger.
 */
const {
    determineStatusFromLevel,
    colorForStatus,
    computeMapPointFromRaw,
} = require('../src/services/floodStatusService');

const THRESHOLDS_S01 = { warning_threshold: 10, danger_threshold: 30 };

describe('Real-time Mapping — đổi màu marker theo MQTT', () => {
    test('value thấp → marker XANH (normal)', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 5,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(5);
        expect(point.status).toBe('normal');
        expect(point.color).toBe('green');
    });

    test('value vượt warning → marker VÀNG', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 15,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(15);
        expect(point.status).toBe('warning');
        expect(point.color).toBe('yellow');
    });

    test('value ngập nặng → marker ĐỎ', () => {
        const before = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 5,
            thresholds: THRESHOLDS_S01,
        });
        const after = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 60,
            thresholds: THRESHOLDS_S01,
        });
        expect(before.color).toBe('green');
        expect(after.water_level).toBe(60);
        expect(after.status).toBe('danger');
        expect(after.color).toBe('red');
    });

    test('Không có ngưỡng riêng → dùng default (warning=10, danger=30)', () => {
        expect(determineStatusFromLevel(5)).toBe('normal');
        expect(determineStatusFromLevel(15)).toBe('warning');
        expect(determineStatusFromLevel(35)).toBe('danger');
        expect(colorForStatus(determineStatusFromLevel(35))).toBe('red');
    });

    test('value hiển thị trực tiếp (không trừ installation_height)', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 60,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(60);
        expect(point.zone).toBe('direct');
    });
});
