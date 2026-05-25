/**
 * Kiểm thử auto-approve: sensor + >= 3 báo cáo mới auto-approve.
 * Không có sensor → chỉ duyệt thủ công.
 */
const autoApproveService = require('../src/services/autoApproveService');
const crowdReportAutoApproveRepository = require('../src/repositories/crowdReportAutoApproveRepository');
const sensorRepository = require('../src/repositories/sensorRepository');

const baseReport = {
    id: 10,
    flood_level: 'Mức 3',
    moderation_status: 'pending',
    auto_approved: false,
    sensor_verified: false,
    nearby_report_count: 0,
    lng: 106.735,
    lat: 10.828
};

describe('checkAutoApprove', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('< 3 báo cáo lân cận → giữ pending, cập nhật count cả cụm', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getReportForAutoApprove').mockResolvedValue(baseReport);
        jest.spyOn(crowdReportAutoApproveRepository, 'countNearbyReports').mockResolvedValue(2);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([
            { status: 'warning', water_level: 15 }
        ]);
        const updateClusterCountSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'updateNearbyCountsInCluster')
            .mockResolvedValue(undefined);
        const updateSensorClusterSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'updateSensorVerifiedInCluster')
            .mockResolvedValue(undefined);
        const applyClusterSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'applyAutoApproveCluster')
            .mockResolvedValue([]);

        const result = await autoApproveService.checkAutoApprove(10);

        expect(result.ok).toBe(true);
        expect(result.nearbyCount).toBe(2);
        expect(result.sensorVerified).toBe(true);
        expect(result.autoApproved).toBe(false);
        expect(result.autoApprovedCount).toBe(0);
        expect(updateClusterCountSpy).toHaveBeenCalledWith(10.828, 106.735, 'Mức 3', 2, 150);
        expect(updateSensorClusterSpy).toHaveBeenCalledWith(10.828, 106.735, 'Mức 3', true, 150);
        expect(applyClusterSpy).not.toHaveBeenCalled();
    });

    test('>= 3 báo cáo + KHÔNG có sensor → KHÔNG auto-approve (chờ duyệt thủ công)', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getReportForAutoApprove').mockResolvedValue(baseReport);
        jest.spyOn(crowdReportAutoApproveRepository, 'countNearbyReports').mockResolvedValue(4);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([]);
        jest.spyOn(crowdReportAutoApproveRepository, 'updateNearbyCountsInCluster').mockResolvedValue(undefined);
        jest.spyOn(crowdReportAutoApproveRepository, 'updateSensorVerifiedInCluster').mockResolvedValue(undefined);
        const applyClusterSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'applyAutoApproveCluster')
            .mockResolvedValue([]);

        const result = await autoApproveService.checkAutoApprove(10);

        expect(result.ok).toBe(true);
        expect(result.nearbyCount).toBe(4);
        expect(result.sensorVerified).toBe(false);
        expect(result.autoApproved).toBe(false);
        expect(applyClusterSpy).not.toHaveBeenCalled();
    });

    test('>= 3 báo cáo + có sensor xác minh → auto duyệt CẢ CỤM', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getReportForAutoApprove').mockResolvedValue(baseReport);
        jest.spyOn(crowdReportAutoApproveRepository, 'countNearbyReports').mockResolvedValue(3);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([
            { sensor_id: 'S01', status: 'warning', water_level: 25 }
        ]);
        jest.spyOn(crowdReportAutoApproveRepository, 'updateNearbyCountsInCluster').mockResolvedValue(undefined);
        jest.spyOn(crowdReportAutoApproveRepository, 'updateSensorVerifiedInCluster').mockResolvedValue(undefined);
        const applyClusterSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'applyAutoApproveCluster')
            .mockResolvedValue([{ id: 10 }, { id: 11 }, { id: 12 }]);

        const result = await autoApproveService.checkAutoApprove(10);

        expect(result.autoApproved).toBe(true);
        expect(result.autoApprovedCount).toBe(3);
        expect(result.autoApprovedIds).toEqual([10, 11, 12]);
        expect(applyClusterSpy).toHaveBeenCalledWith(10.828, 106.735, 'Mức 3', 150);
    });

    test('>= 3 báo cáo + sensor elevated → sensor_verified true, auto-approve', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getReportForAutoApprove').mockResolvedValue(baseReport);
        jest.spyOn(crowdReportAutoApproveRepository, 'countNearbyReports').mockResolvedValue(5);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([
            { sensor_id: 'S01', status: 'elevated', water_level: 25 }
        ]);
        jest.spyOn(crowdReportAutoApproveRepository, 'updateNearbyCountsInCluster').mockResolvedValue(undefined);
        const updateSensorClusterSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'updateSensorVerifiedInCluster')
            .mockResolvedValue(undefined);
        jest.spyOn(crowdReportAutoApproveRepository, 'applyAutoApproveCluster').mockResolvedValue([{ id: 10 }]);

        const result = await autoApproveService.checkAutoApprove(10);

        expect(result.sensorVerified).toBe(true);
        expect(result.autoApproved).toBe(true);
        expect(updateSensorClusterSpy).toHaveBeenCalledWith(10.828, 106.735, 'Mức 3', true, 150);
    });
});

describe('verifySensorInArea', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('trả false khi không có sensor', async () => {
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([]);
        await expect(autoApproveService.verifySensorInArea(10.828, 106.735)).resolves.toBe(false);
    });

    test('trả true khi sensor danger', async () => {
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([
            { status: 'danger', water_level: 40 }
        ]);
        await expect(autoApproveService.verifySensorInArea(10.828, 106.735)).resolves.toBe(true);
    });

    test('trả true khi sensor elevated', async () => {
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([
            { status: 'elevated', water_level: 25 }
        ]);
        await expect(autoApproveService.verifySensorInArea(10.828, 106.735)).resolves.toBe(true);
    });

    test('trả true khi sensor critical', async () => {
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([
            { status: 'critical', water_level: 55 }
        ]);
        await expect(autoApproveService.verifySensorInArea(10.828, 106.735)).resolves.toBe(true);
    });
});
