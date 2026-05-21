const {
    computeWaterLevelFromDistance,
    DEFAULT_INSTALLATION_HEIGHT_CM,
    DEFAULT_MIN_BLIND_DISTANCE_CM
} = require('../src/utils/ultrasonicWaterLevel');

const H = DEFAULT_INSTALLATION_HEIGHT_CM; // 75 cm — khớp firmware NODE
const MIN_D = DEFAULT_MIN_BLIND_DISTANCE_CM; // 20 cm
const MAX_WL = H - MIN_D; // 55 cm

describe('ultrasonicWaterLevel — sơ đồ ống 75cm', () => {
    test('distance = 75cm (mặt đất khô) → mực nước 0cm', () => {
        const r = computeWaterLevelFromDistance(75, { installationHeightCm: H });
        expect(r.zone).toBe('dry');
        expect(r.water_level_cm).toBe(0);
        expect(r.water_level_percent).toBe(0);
    });

    test('distance > 75cm → vẫn 0cm (khô)', () => {
        const r = computeWaterLevelFromDistance(80, { installationHeightCm: H });
        expect(r.zone).toBe('dry');
        expect(r.water_level_cm).toBe(0);
    });

    test('distance = 50cm → mực nước 25cm', () => {
        const r = computeWaterLevelFromDistance(50, { installationHeightCm: H });
        expect(r.zone).toBe('normal');
        expect(r.water_level_cm).toBe(25);
    });

    test('distance = 20cm (biên vùng mù) → mực nước tối đa 55cm', () => {
        const r = computeWaterLevelFromDistance(20, { installationHeightCm: H });
        expect(r.zone).toBe('blind_zone');
        expect(r.water_level_cm).toBe(MAX_WL);
        expect(r.water_level_percent).toBe(100);
    });

    test('distance < 20cm (vùng mù) → cap 55cm, không vượt thang đo', () => {
        const r = computeWaterLevelFromDistance(10, { installationHeightCm: H });
        expect(r.zone).toBe('blind_zone');
        expect(r.water_level_cm).toBe(MAX_WL);
    });

    test('distance = 0 hoặc âm → invalid', () => {
        expect(computeWaterLevelFromDistance(0, { installationHeightCm: H }).zone).toBe(
            'invalid'
        );
    });

    test('installationHeight 100cm (S01) — công thức tuyến tính', () => {
        const r = computeWaterLevelFromDistance(85, { installationHeightCm: 100 });
        expect(r.water_level_cm).toBe(15);
        expect(r.zone).toBe('normal');
    });
});
