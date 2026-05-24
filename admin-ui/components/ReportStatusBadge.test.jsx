/**
 * @jest-environment jsdom
 */
const React = require('react');
const { render, screen } = require('@testing-library/react');
const { ReportStatusBadge } = require('./ReportStatusBadge');

describe('ReportStatusBadge', () => {
    test('auto_approved → badge Tự động duyệt', () => {
        render(
            <ReportStatusBadge
                report={{
                    moderation_status: 'approved',
                    auto_approved: true,
                    sensor_verified: true,
                    nearby_report_count: 5
                }}
            />
        );
        expect(screen.getByTestId('badge-auto-approved').textContent).toMatch(/Tự động duyệt/);
    });

    test('pending, nearby 3/5 → badge Gần tự duyệt', () => {
        render(
            <ReportStatusBadge
                report={{
                    moderation_status: 'pending',
                    auto_approved: false,
                    sensor_verified: false,
                    nearby_report_count: 3
                }}
            />
        );
        expect(screen.getByTestId('badge-pending-auto').textContent).toMatch(/Gần tự duyệt \(3\/5\)/);
    });

    test('pending, không gần ngưỡng, có sensor → Có cảm biến', () => {
        render(
            <ReportStatusBadge
                report={{
                    moderation_status: 'pending',
                    auto_approved: false,
                    sensor_verified: true,
                    nearby_report_count: 0
                }}
            />
        );
        expect(screen.getByTestId('badge-sensor-verified').textContent).toMatch(/Có cảm biến/);
    });

    test('pending thủ công → Chờ duyệt thủ công', () => {
        render(
            <ReportStatusBadge
                report={{
                    moderation_status: 'pending',
                    auto_approved: false,
                    sensor_verified: false,
                    nearby_report_count: 0
                }}
            />
        );
        expect(screen.getByTestId('badge-pending-manual').textContent).toMatch(/Chờ duyệt thủ công/);
    });

    test('rejected → Đã từ chối', () => {
        render(
            <ReportStatusBadge report={{ moderation_status: 'rejected', auto_approved: false }} />
        );
        expect(screen.getByTestId('badge-rejected').textContent).toMatch(/Đã từ chối/);
    });

    test('approved thủ công (không auto) → Đã duyệt', () => {
        render(
            <ReportStatusBadge
                report={{
                    moderation_status: 'approved',
                    auto_approved: false,
                    nearby_report_count: 0
                }}
            />
        );
        expect(screen.getByTestId('badge-approved').textContent).toMatch(/Đã duyệt/);
    });
});
