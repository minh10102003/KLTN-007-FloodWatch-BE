const {
    mapFloodLevel,
    floodLevelToCm,
    getFloodLevelLabel,
    VALID_LEVELS
} = require('../src/utils/floodLevelMapper');

describe('floodLevelMapper — 5 mức', () => {
    test('VALID_LEVELS có 5 mức', () => {
        expect(VALID_LEVELS).toEqual(['Mức 1', 'Mức 2', 'Mức 3', 'Mức 4', 'Mức 5']);
    });

    test('map mức mới và số 1–5', () => {
        expect(mapFloodLevel('Mức 3')).toBe('Mức 3');
        expect(mapFloodLevel('3')).toBe('Mức 3');
        expect(mapFloodLevel('Mức 5 - trên 50 cm')).toBe('Mức 5');
    });

    test('map legacy Nhẹ / Trung bình / Nặng', () => {
        expect(mapFloodLevel('Nhẹ')).toBe('Mức 1');
        expect(mapFloodLevel('Trung bình')).toBe('Mức 3');
        expect(mapFloodLevel('Nặng')).toBe('Mức 5');
    });

    test('floodLevelToCm', () => {
        expect(floodLevelToCm('Mức 1')).toBe(10);
        expect(floodLevelToCm('Mức 2')).toBe(20);
        expect(floodLevelToCm('Mức 5')).toBe(55);
    });

    test('getFloodLevelLabel', () => {
        expect(getFloodLevelLabel('Mức 2')).toBe('Mức 2 - 20 cm');
    });
});
