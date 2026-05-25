/**
 * Kiểm thử chức năng 1.1 — Giám sát mực nước thời gian thực (Real-time Mapping).
 *
 * 5 mức cảnh báo sensor theo bảng màu báo cáo ngập:
 *   Mức 1 (<10 cm): normal   → #4CAF50 (xanh lá)
 *   Mức 2 (10–20):  warning  → #FFEB3B (vàng)
 *   Mức 3 (20–30):  elevated → #FF9800 (cam)
 *   Mức 4 (30–50):  danger   → #F44336 (đỏ)
 *   Mức 5 (≥50):    critical → #B71C1C (đỏ sẫm)
 */
const {
    determineStatusFromLevel,
    colorForStatus,
    computeMapPointFromRaw,
} = require('../src/services/floodStatusService');

const THRESHOLDS_S01 = {
    warning_threshold: 10,
    elevated_threshold: 20,
    danger_threshold: 30,
    critical_threshold: 50,
};

describe('Real-time Mapping — đổi màu marker theo MQTT (5 mức)', () => {
    test('Mức 1: value thấp → marker XANH LÁ (normal)', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 5,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(5);
        expect(point.status).toBe('normal');
        expect(point.color).toBe('#4CAF50');
    });

    test('Mức 2: value vượt warning → marker VÀNG', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 15,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(15);
        expect(point.status).toBe('warning');
        expect(point.color).toBe('#FFEB3B');
    });

    test('Mức 3: value vượt elevated → marker CAM', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 25,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(25);
        expect(point.status).toBe('elevated');
        expect(point.color).toBe('#FF9800');
    });

    test('Mức 4: value vượt danger → marker ĐỎ', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 35,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(35);
        expect(point.status).toBe('danger');
        expect(point.color).toBe('#F44336');
    });

    test('Mức 5: value vượt critical → marker ĐỎ SẪM', () => {
        const point = computeMapPointFromRaw({
            sensorId: 'S01',
            rawDistance: 60,
            thresholds: THRESHOLDS_S01,
        });
        expect(point.water_level).toBe(60);
        expect(point.status).toBe('critical');
        expect(point.color).toBe('#B71C1C');
    });

    test('Chuyển từ normal → critical khi mực nước tăng mạnh', () => {
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
        expect(before.color).toBe('#4CAF50');
        expect(after.water_level).toBe(60);
        expect(after.status).toBe('critical');
        expect(after.color).toBe('#B71C1C');
    });

    test('Không có ngưỡng riêng → dùng default 5 mức', () => {
        expect(determineStatusFromLevel(5)).toBe('normal');
        expect(determineStatusFromLevel(15)).toBe('warning');
        expect(determineStatusFromLevel(25)).toBe('elevated');
        expect(determineStatusFromLevel(35)).toBe('danger');
        expect(determineStatusFromLevel(55)).toBe('critical');
        expect(colorForStatus(determineStatusFromLevel(55))).toBe('#B71C1C');
    });

    test('Giá trị biên: đúng tại ngưỡng', () => {
        expect(determineStatusFromLevel(10)).toBe('warning');
        expect(determineStatusFromLevel(20)).toBe('elevated');
        expect(determineStatusFromLevel(30)).toBe('danger');
        expect(determineStatusFromLevel(50)).toBe('critical');
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
