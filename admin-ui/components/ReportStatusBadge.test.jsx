/**
 * @jest-environment jsdom
 */
const React = require('react');
const { render, screen } = require('@testing-library/react');
const {
    ReportStatusBadge,
    ModerationStatusBadge,
    ValidationStatusBadge
} = require('./ReportStatusBadge');

describe('ModerationStatusBadge — chỉ kiểm duyệt', () => {
    test('pending → Chờ duyệt', () => {
        render(<ModerationStatusBadge report={{ moderation_status: 'pending' }} />);
        expect(screen.getByTestId('badge-pending').textContent).toMatch(/Chờ duyệt/);
    });

    test('auto_approved → Tự động duyệt', () => {
        render(
            <ModerationStatusBadge
                report={{ moderation_status: 'approved', auto_approved: true }}
            />
        );
        expect(screen.getByTestId('badge-auto-approved').textContent).toMatch(/Tự động duyệt/);
    });

    test('cross_verified vẫn hiện Chờ duyệt nếu moderation pending', () => {
        render(
            <ModerationStatusBadge
                report={{
                    moderation_status: 'pending',
                    validation_status: 'cross_verified'
                }}
            />
        );
        expect(screen.getByTestId('badge-pending').textContent).toMatch(/Chờ duyệt/);
        expect(screen.queryByTestId('badge-cross-verified')).toBeNull();
    });
});

describe('ValidationStatusBadge — chỉ xác minh chéo', () => {
    test('cross_verified → Xác minh chéo', () => {
        render(<ValidationStatusBadge report={{ validation_status: 'cross_verified' }} />);
        expect(screen.getByTestId('badge-cross-verified').textContent).toMatch(/Xác minh chéo/);
    });

    test('pending → Chưa xác minh chéo', () => {
        render(<ValidationStatusBadge report={{ validation_status: 'pending' }} />);
        expect(screen.getByTestId('badge-validation-pending').textContent).toMatch(
            /Chưa xác minh chéo/
        );
    });
});

describe('ReportStatusBadge — 2 badge tách riêng', () => {
    test('pending + cross_verified → cả Chờ duyệt và Xác minh chéo', () => {
        render(
            <ReportStatusBadge
                report={{
                    moderation_status: 'pending',
                    validation_status: 'cross_verified'
                }}
            />
        );
        expect(screen.getByTestId('badge-pending').textContent).toMatch(/Chờ duyệt/);
        expect(screen.getByTestId('badge-cross-verified').textContent).toMatch(/Xác minh chéo/);
    });
});
