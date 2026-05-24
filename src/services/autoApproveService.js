const sensorRepository = require('../repositories/sensorRepository');
const crowdReportAutoApproveRepository = require('../repositories/crowdReportAutoApproveRepository');

const AUTO_APPROVE_THRESHOLD = 5;
/** 150m: 100m quá hẹp — user chọn gần nhau trên map vẫn có thể cách ~115m thực tế */
const NEARBY_RADIUS_METERS = Number(process.env.AUTO_APPROVE_RADIUS_METERS) || 150;
const SENSOR_VERIFY_RADIUS_METERS = 500;

/**
 * Đếm báo cáo trong bán kính, cùng flood_level.
 */
async function countNearbyReports(lat, lng, floodLevel, radiusMeters = NEARBY_RADIUS_METERS) {
    return crowdReportAutoApproveRepository.countNearbyReports(
        lat,
        lng,
        floodLevel,
        radiusMeters
    );
}

/**
 * Có cảm biến active trong khu vực với dấu hiệu ngập (warning/danger hoặc mực nước đáng kể).
 */
async function verifySensorInArea(lat, lng) {
    const sensors = await sensorRepository.findSensorsInRadius(
        lng,
        lat,
        SENSOR_VERIFY_RADIUS_METERS
    );
    if (!sensors || sensors.length === 0) return false;
    return sensors.some((s) => {
        if (s.status === 'warning' || s.status === 'danger') return true;
        const level = Number(s.water_level);
        return Number.isFinite(level) && level >= 10;
    });
}

/**
 * Kiểm tra và auto-approve cả cụm nếu đủ 5 báo cáo lân cận cùng mức ngập.
 * Khi đủ ngưỡng: duyệt TẤT CẢ pending trong bán kính (mặc định 150m).
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
    if (count >= AUTO_APPROVE_THRESHOLD) {
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
