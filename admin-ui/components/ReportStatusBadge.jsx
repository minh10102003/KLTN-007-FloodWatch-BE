const React = require('react');

const AUTO_APPROVE_THRESHOLD = 5;

/**
 * Chỉ trạng thái kiểm duyệt (pending / duyệt / từ chối / tự động duyệt).
 */
function ModerationStatusBadge({ report }) {
    if (!report) {
        return (
            <span data-testid="badge-moderation-unknown" className="badge badge-unknown">
                Không xác định
            </span>
        );
    }

    const status = report.moderation_status || report.status;
    const autoApproved = Boolean(report.auto_approved);
    const nearby = Number(report.nearby_report_count) || 0;

    if (status === 'rejected') {
        return (
            <span data-testid="badge-rejected" className="badge badge-rejected">
                Đã từ chối
            </span>
        );
    }

    if (autoApproved) {
        return (
            <span data-testid="badge-auto-approved" className="badge badge-auto-approved">
                Tự động duyệt
            </span>
        );
    }

    if (status === 'approved') {
        return (
            <span data-testid="badge-approved" className="badge badge-approved">
                Đã duyệt
            </span>
        );
    }

    if (status === 'pending') {
        return (
            <span data-testid="badge-pending" className="badge badge-pending">
                Chờ duyệt
                {nearby > 0 && nearby < AUTO_APPROVE_THRESHOLD ? (
                    <small data-testid="badge-pending-auto-hint" className="badge-hint">
                        {' '}
                        (Gần tự duyệt {nearby}/{AUTO_APPROVE_THRESHOLD})
                    </small>
                ) : null}
            </span>
        );
    }

    return (
        <span data-testid="badge-moderation-unknown" className="badge badge-unknown">
            Không xác định
        </span>
    );
}

/**
 * Chỉ xác minh chéo sensor — tách khỏi kiểm duyệt.
 */
function ValidationStatusBadge({ report }) {
    if (!report) {
        return (
            <span data-testid="badge-validation-pending" className="badge badge-validation-pending">
                Chưa xác minh chéo
            </span>
        );
    }

    const vs = report.validation_status || 'pending';

    if (vs === 'cross_verified') {
        return (
            <span data-testid="badge-cross-verified" className="badge badge-cross-verified">
                Xác minh chéo
            </span>
        );
    }
    if (vs === 'verified') {
        return (
            <span data-testid="badge-validation-verified" className="badge badge-validation-verified">
                Đã xác minh
            </span>
        );
    }
    if (vs === 'rejected') {
        return (
            <span data-testid="badge-validation-rejected" className="badge badge-validation-rejected">
                Xác minh không đạt
            </span>
        );
    }

    return (
        <span data-testid="badge-validation-pending" className="badge badge-validation-pending">
            Chưa xác minh chéo
        </span>
    );
}

/**
 * Admin: 2 badge độc lập — kiểm duyệt + xác minh chéo.
 */
function ReportStatusBadge({ report, showValidation = true }) {
    return (
        <div data-testid="report-status-badges" className="report-status-badges">
            <ModerationStatusBadge report={report} />
            {showValidation ? (
                <ValidationStatusBadge report={report} />
            ) : null}
        </div>
    );
}

module.exports = {
    ReportStatusBadge,
    ModerationStatusBadge,
    ValidationStatusBadge,
    AUTO_APPROVE_THRESHOLD
};
