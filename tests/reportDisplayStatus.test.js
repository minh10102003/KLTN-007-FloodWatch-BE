/**
 * Tách nhãn kiểm duyệt vs xác minh chéo.
 * Threshold auto-approve = 3, yêu cầu sensor_verified.
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

    test('pending + sensor_verified + nearby 2/3 → hint "Gần tự duyệt (2/3)"', () => {
        const report = {
            moderation_status: 'pending',
            sensor_verified: true,
            nearby_report_count: 2
        };
        const display = getModerationDisplay(report);
        expect(display.key).toBe('pending_near_auto');
        expect(display.hint).toBe('Gần tự duyệt (2/3)');
    });

    test('pending + skip_auto_approve (no sensor) → hint "Khu vực không có cảm biến"', () => {
        const report = {
            moderation_status: 'pending',
            skip_auto_approve: true,
            no_sensor_coverage: true
        };
        const display = getModerationDisplay(report);
        expect(display.key).toBe('pending_manual_only');
        expect(display.hint).toBe('Khu vực không có cảm biến');
    });

    test('pending + skip_auto_approve (có sensor, mod skip) → hint "Đã bỏ qua auto-approve"', () => {
        const report = {
            moderation_status: 'pending',
            skip_auto_approve: true,
            no_sensor_coverage: false
        };
        const display = getModerationDisplay(report);
        expect(display.key).toBe('pending_manual_only');
        expect(display.hint).toBe('Đã bỏ qua auto-approve');
    });

    test('validation display: no sensor → "Không có cảm biến gần"', () => {
        const report = {
            validation_status: 'pending',
            skip_auto_approve: true,
            sensor_verified: false
        };
        expect(getValidationDisplay(report)).toEqual({
            key: 'no_sensor',
            label: 'Không có cảm biến gần'
        });
    });
});
