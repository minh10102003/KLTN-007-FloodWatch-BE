const React = require('react');

const AUTO_APPROVE_THRESHOLD = 5;

/**
 * Badge trạng thái báo cáo trên trang Admin.
 */
function ReportStatusBadge({ report }) {
    if (!report) {
        return (
            <span data-testid="badge-unknown" className="badge badge-unknown">
                Không xác định
            </span>
        );
    }

    const status = report.moderation_status || report.status;
    const autoApproved = Boolean(report.auto_approved);
    const sensorVerified = Boolean(report.sensor_verified);
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

    if (
        status === 'pending' &&
        nearby > 0 &&
        nearby < AUTO_APPROVE_THRESHOLD
    ) {
        return (
            <span data-testid="badge-pending-auto" className="badge badge-pending-auto">
                Gần tự duyệt ({nearby}/{AUTO_APPROVE_THRESHOLD})
            </span>
        );
    }

    if (sensorVerified) {
        return (
            <span data-testid="badge-sensor-verified" className="badge badge-sensor-verified">
                Có cảm biến
            </span>
        );
    }

    if (status === 'pending') {
        return (
            <span data-testid="badge-pending-manual" className="badge badge-pending-manual">
                Chờ duyệt thủ công
            </span>
        );
    }

    return (
        <span data-testid="badge-unknown" className="badge badge-unknown">
            Không xác định
        </span>
    );
}

module.exports = { ReportStatusBadge, AUTO_APPROVE_THRESHOLD };
