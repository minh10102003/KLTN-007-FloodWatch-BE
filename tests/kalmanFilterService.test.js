/**
 * Kiểm thử lọc nhiễu Kalman (BE Node.js + Jest — tương đương hướng NestJS + Jest trong luận văn).
 */
const { KalmanFilter, filterWaterLevelSeries } = require('../src/services/kalmanFilterService');

describe('KalmanFilter — lọc chuỗi mực nước có spike', () => {
    test('filterWaterLevelSeries: spike 100 không xuất hiện ở đầu ra (gate innovation)', () => {
        const noisy = [10, 100, 11, 12];
        const filtered = filterWaterLevelSeries(noisy, {
            processNoise: 0.01,
            measurementNoise: 0.25,
            innovationGateCm: 30,
        });

        expect(filtered).toHaveLength(noisy.length);
        expect(filtered).not.toContain(100);
        expect(filtered[0]).toBe(10);
        expect(filtered.every((v) => Number.isFinite(v))).toBe(true);
    });

    test('Kalman không gate: spike vẫn kéo estimate mạnh (không “loại” hẳng 100 trong một bước)', () => {
        const k = new KalmanFilter(0.01, 0.25, null);
        expect(k.filter(10)).toBe(10);
        const afterSpike = k.filter(100);
        expect(afterSpike).toBeGreaterThan(50);
        expect(afterSpike).toBeLessThan(100);
    });

    test('filterWaterLevelSeries: không gate — hành vi giống pipeline MQTT trên chuỗi ngắn', () => {
        const filtered = filterWaterLevelSeries([10, 100, 11, 12]);
        expect(filtered[1]).toBeCloseTo(82.142857, 3);
    });
});
