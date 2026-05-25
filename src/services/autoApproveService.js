const sensorRepository = require('../repositories/sensorRepository');
const crowdReportAutoApproveRepository = require('../repositories/crowdReportAutoApproveRepository');

const AUTO_APPROVE_THRESHOLD = 3;
const NEARBY_RADIUS_METERS = Number(process.env.AUTO_APPROVE_RADIUS_METERS) || 150;
const SENSOR_VERIFY_RADIUS_METERS = 500;

async function countNearbyReports(lat, lng, floodLevel, radiusMeters = NEARBY_RADIUS_METERS) {
    return crowdReportAutoApproveRepository.countNearbyReports(
        lat,
        lng,
        floodLevel,
        radiusMeters
    );
}

/**
 * Có cảm biến active trong khu vực với dấu hiệu ngập
 * (warning/elevated/danger/critical hoặc mực nước >= 10cm).
 */
async function verifySensorInArea(lat, lng) {
    const sensors = await sensorRepository.findSensorsInRadius(
        lng,
        lat,
        SENSOR_VERIFY_RADIUS_METERS
    );
    if (!sensors || sensors.length === 0) return false;
    return sensors.some((s) => {
        const st = s.status;
        if (st === 'warning' || st === 'elevated' || st === 'danger' || st === 'critical') return true;
        const level = Number(s.water_level);
        return Number.isFinite(level) && level >= 10;
    });
}

/**
 * Auto-approve khi ĐỦ 2 điều kiện:
 *   1. sensorVerified = true (có sensor xác minh ngập trong 500m)
 *   2. >= 3 báo cáo lân cận cùng mức ngập (trong 150m)
 *
 * Khu vực không có sensor → chỉ duyệt thủ công bởi moderator.
 */
async function checkAutoApprove(reportId) {
    const report = await crowdReportAutoApproveRepository.getReportForAutoApprove(reportId);
    if (!report) {
        return { ok: false, reason: 'not_found' };
    }

    const count = await countNearbyReports(
        report.lat,
        report.lng,
        report.flood_level,
        NEARBY_RADIUS_METERS
    );

    await crowdReportAutoApproveRepository.updateNearbyCountsInCluster(
        report.lat,
        report.lng,
        report.flood_level,
        count,
        NEARBY_RADIUS_METERS
    );

    const sensorVerified = await verifySensorInArea(report.lat, report.lng);
    await crowdReportAutoApproveRepository.updateSensorVerifiedInCluster(
        report.lat,
        report.lng,
        report.flood_level,
        sensorVerified,
        NEARBY_RADIUS_METERS
    );

    let approvedRows = [];
    if (sensorVerified && count >= AUTO_APPROVE_THRESHOLD) {
        approvedRows = await crowdReportAutoApproveRepository.applyAutoApproveCluster(
            report.lat,
            report.lng,
            report.flood_level,
            NEARBY_RADIUS_METERS
        );
    }

    const approvedIds = approvedRows.map((r) => r.id);

    return {
        ok: true,
        reportId,
        nearbyCount: count,
        sensorVerified,
        autoApproved: approvedIds.length > 0,
        autoApprovedIds: approvedIds,
        autoApprovedCount: approvedIds.length,
        threshold: AUTO_APPROVE_THRESHOLD
    };
}

module.exports = {
    checkAutoApprove,
    countNearbyReports,
    verifySensorInArea,
    AUTO_APPROVE_THRESHOLD,
    NEARBY_RADIUS_METERS
};
