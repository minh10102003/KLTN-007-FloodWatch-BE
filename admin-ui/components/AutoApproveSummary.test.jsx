/**
 * @jest-environment jsdom
 */
const React = require('react');
const { render, screen } = require('@testing-library/react');
const { AutoApproveSummary, SUMMARY_FIELDS } = require('./AutoApproveSummary');

describe('AutoApproveSummary', () => {
    const summary = {
        total_active: 100,
        auto_approved: 20,
        pending_manual_review: 15,
        sensor_verified: 30,
        pending_auto_approve: 5
    };

    test('render đúng 5 số liệu', () => {
        render(<AutoApproveSummary summary={summary} />);

        expect(screen.getByTestId('auto-approve-summary')).toBeTruthy();
        expect(SUMMARY_FIELDS).toHaveLength(5);

        SUMMARY_FIELDS.forEach(({ key }) => {
            const card = screen.getByTestId(`summary-${key}`);
            expect(card).toBeTruthy();
            expect(card.textContent).toContain(String(summary[key]));
        });
    });

    test('summary rỗng → hiển thị 0 cho mọi chỉ số', () => {
        render(<AutoApproveSummary summary={{}} />);

        SUMMARY_FIELDS.forEach(({ key }) => {
            const card = screen.getByTestId(`summary-${key}`);
            expect(card.textContent).toContain('0');
        });
    });
});
