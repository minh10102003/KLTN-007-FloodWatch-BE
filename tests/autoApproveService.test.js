/**
 * Kiểm thử auto-approve: <5, >=5 không sensor, >=5 có sensor, duyệt cả cụm.
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

    test('< 5 báo cáo lân cận → giữ pending, cập nhật count cả cụm', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getReportForAutoApprove').mockResolvedValue(baseReport);
        jest.spyOn(crowdReportAutoApproveRepository, 'countNearbyReports').mockResolvedValue(3);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([]);
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
        expect(result.nearbyCount).toBe(3);
        expect(result.autoApproved).toBe(false);
        expect(result.autoApprovedCount).toBe(0);
        expect(updateClusterCountSpy).toHaveBeenCalledWith(10.828, 106.735, 'Mức 3', 3, 150);
        expect(updateSensorClusterSpy).toHaveBeenCalledWith(10.828, 106.735, 'Mức 3', false, 150);
        expect(applyClusterSpy).not.toHaveBeenCalled();
    });

    test('>= 5 báo cáo → auto duyệt CẢ CỤM pending', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getReportForAutoApprove').mockResolvedValue(baseReport);
        jest.spyOn(crowdReportAutoApproveRepository, 'countNearbyReports').mockResolvedValue(5);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([]);
        jest.spyOn(crowdReportAutoApproveRepository, 'updateNearbyCountsInCluster').mockResolvedValue(undefined);
        jest.spyOn(crowdReportAutoApproveRepository, 'updateSensorVerifiedInCluster').mockResolvedValue(undefined);
        const applyClusterSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'applyAutoApproveCluster')
            .mockResolvedValue([{ id: 115 }, { id: 116 }, { id: 117 }, { id: 118 }, { id: 119 }]);

        const result = await autoApproveService.checkAutoApprove(119);

        expect(result.autoApproved).toBe(true);
        expect(result.autoApprovedCount).toBe(5);
        expect(result.autoApprovedIds).toEqual([115, 116, 117, 118, 119]);
        expect(applyClusterSpy).toHaveBeenCalledWith(10.828, 106.735, 'Mức 3', 150);
    });

    test('>= 5 báo cáo, có sensor → sensor_verified true cho cụm', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getReportForAutoApprove').mockResolvedValue(baseReport);
        jest.spyOn(crowdReportAutoApproveRepository, 'countNearbyReports').mockResolvedValue(6);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([
            { sensor_id: 'S01', status: 'warning', water_level: 25 }
        ]);
        jest.spyOn(crowdReportAutoApproveRepository, 'updateNearbyCountsInCluster').mockResolvedValue(undefined);
        const updateSensorClusterSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'updateSensorVerifiedInCluster')
            .mockResolvedValue(undefined);
        jest.spyOn(crowdReportAutoApproveRepository, 'applyAutoApproveCluster').mockResolvedValue([{ id: 10 }]);

        const result = await autoApproveService.checkAutoApprove(10);

        expect(result.sensorVerified).toBe(true);
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
});
