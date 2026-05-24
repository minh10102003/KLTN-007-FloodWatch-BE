/**
 * Tách nhãn kiểm duyệt vs xác minh chéo chéo.
 */
const {
    getModerationDisplay,
    getValidationDisplay,
    withReportDisplayStatus
} = require('../src/utils/reportDisplayStatus');

describe('reportDisplayStatus', () => {
    test('cross_verified + pending → kiểm duyệt Chờ duyệt, validation Xác minh chéo', () => {
        const report = {
            moderation_status: 'pending',
            validation_status: 'cross_verified',
            verified_by_sensor: true
        };
        expect(getModerationDisplay(report)).toEqual({ key: 'pending', label: 'Chờ duyệt' });
        expect(getValidationDisplay(report)).toEqual({ key: 'cross_verified', label: 'Xác minh chéo' });
    });

    test('approved + cross_verified → Đã duyệt và Xác minh chéo độc lập', () => {
        const report = {
            moderation_status: 'approved',
            auto_approved: false,
            validation_status: 'cross_verified'
        };
        expect(getModerationDisplay(report).label).toBe('Đã duyệt');
        expect(getValidationDisplay(report).label).toBe('Xác minh chéo');
    });

    test('withReportDisplayStatus thêm display_moderation và display_validation', () => {
        const out = withReportDisplayStatus({
            moderation_status: 'pending',
            validation_status: 'pending'
        });
        expect(out.display_moderation.label).toBe('Chờ duyệt');
        expect(out.display_validation.label).toBe('Chưa xác minh chéo');
    });
});
