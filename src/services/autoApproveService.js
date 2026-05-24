const sensorRepository = require('../repositories/sensorRepository');
const crowdReportAutoApproveRepository = require('../repositories/crowdReportAutoApproveRepository');

const AUTO_APPROVE_THRESHOLD = 5;
const NEARBY_RADIUS_METERS = 100;
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
 * Kiểm tra và auto-approve nếu đủ 5 báo cáo lân cận cùng mức ngập.
 * Không thay đổi flow duyệt thủ công (chỉ UPDATE khi vẫn pending).
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
    await crowdReportAutoApproveRepository.updateNearbyReportCount(reportId, count);

    const sensorVerified = await verifySensorInArea(report.lat, report.lng);
    await crowdReportAutoApproveRepository.updateSensorVerified(reportId, sensorVerified);

    let autoApproved = false;
    if (count >= AUTO_APPROVE_THRESHOLD && report.moderation_status === 'pending') {
        await crowdReportAutoApproveRepository.applyAutoApprove(reportId);
        autoApproved = true;
    }

    return {
        ok: true,
        reportId,
        nearbyCount: count,
        sensorVerified,
        autoApproved,
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
