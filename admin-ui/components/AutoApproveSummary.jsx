const React = require('react');

const SUMMARY_FIELDS = [
    { key: 'total_active', label: 'Báo cáo đang hoạt động' },
    { key: 'auto_approved', label: 'Tự động duyệt' },
    { key: 'pending_manual_review', label: 'Chờ duyệt thủ công' },
    { key: 'sensor_verified', label: 'Xác minh cảm biến' },
    { key: 'pending_auto_approve', label: 'Gần đủ điều kiện tự duyệt' }
];

/**
 * Dashboard 5 chỉ số auto-approve (Admin /admin/reports).
 */
function AutoApproveSummary({ summary = {} }) {
    return (
        <section data-testid="auto-approve-summary" className="auto-approve-summary">
            {SUMMARY_FIELDS.map(({ key, label }) => (
                <div key={key} data-testid={`summary-${key}`} className="summary-card">
                    <span className="summary-label">{label}</span>
                    <strong className="summary-value">{Number(summary[key] ?? 0)}</strong>
                </div>
            ))}
        </section>
    );
}

module.exports = { AutoApproveSummary, SUMMARY_FIELDS };
