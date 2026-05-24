/**
 * Kiểm thử auto-approve: <5, >=5 không sensor, >=5 có sensor.
 */
const autoApproveService = require('../src/services/autoApproveService');
const crowdReportAutoApproveRepository = require('../src/repositories/crowdReportAutoApproveRepository');
const sensorRepository = require('../src/repositories/sensorRepository');

const baseReport = {
    id: 10,
    flood_level: 'Trung bình',
    moderation_status: 'pending',
    auto_approved: false,
    sensor_verified: false,
    nearby_report_count: 0,
    lng: 106.7,
    lat: 10.77
};

describe('checkAutoApprove', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('< 5 báo cáo lân cận → giữ pending, không auto_approved, cập nhật nearby_report_count', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getReportForAutoApprove').mockResolvedValue(baseReport);
        jest.spyOn(crowdReportAutoApproveRepository, 'countNearbyReports').mockResolvedValue(3);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([]);
        const updateCountSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'updateNearbyReportCount')
            .mockResolvedValue(undefined);
        const updateSensorSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'updateSensorVerified')
            .mockResolvedValue(undefined);
        const applySpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'applyAutoApprove')
            .mockResolvedValue(undefined);

        const result = await autoApproveService.checkAutoApprove(10);

        expect(result.ok).toBe(true);
        expect(result.nearbyCount).toBe(3);
        expect(result.autoApproved).toBe(false);
        expect(result.sensorVerified).toBe(false);
        expect(updateCountSpy).toHaveBeenCalledWith(10, 3);
        expect(updateSensorSpy).toHaveBeenCalledWith(10, false);
        expect(applySpy).not.toHaveBeenCalled();
    });

    test('>= 5 báo cáo, không có sensor → auto duyệt, sensor_verified = false', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getReportForAutoApprove').mockResolvedValue(baseReport);
        jest.spyOn(crowdReportAutoApproveRepository, 'countNearbyReports').mockResolvedValue(5);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([]);
        jest.spyOn(crowdReportAutoApproveRepository, 'updateNearbyReportCount').mockResolvedValue(undefined);
        const updateSensorSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'updateSensorVerified')
            .mockResolvedValue(undefined);
        const applySpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'applyAutoApprove')
            .mockResolvedValue(undefined);

        const result = await autoApproveService.checkAutoApprove(10);

        expect(result.autoApproved).toBe(true);
        expect(result.sensorVerified).toBe(false);
        expect(updateSensorSpy).toHaveBeenCalledWith(10, false);
        expect(applySpy).toHaveBeenCalledWith(10);
    });

    test('>= 5 báo cáo, có sensor warning/danger → auto duyệt, sensor_verified = true', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getReportForAutoApprove').mockResolvedValue(baseReport);
        jest.spyOn(crowdReportAutoApproveRepository, 'countNearbyReports').mockResolvedValue(6);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([
            { sensor_id: 'S01', status: 'warning', water_level: 25 }
        ]);
        jest.spyOn(crowdReportAutoApproveRepository, 'updateNearbyReportCount').mockResolvedValue(undefined);
        const updateSensorSpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'updateSensorVerified')
            .mockResolvedValue(undefined);
        const applySpy = jest
            .spyOn(crowdReportAutoApproveRepository, 'applyAutoApprove')
            .mockResolvedValue(undefined);

        const result = await autoApproveService.checkAutoApprove(10);

        expect(result.autoApproved).toBe(true);
        expect(result.sensorVerified).toBe(true);
        expect(updateSensorSpy).toHaveBeenCalledWith(10, true);
        expect(applySpy).toHaveBeenCalledWith(10);
    });
});

describe('verifySensorInArea', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('trả false khi không có sensor', async () => {
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([]);
        await expect(autoApproveService.verifySensorInArea(10.77, 106.7)).resolves.toBe(false);
    });

    test('trả true khi sensor danger', async () => {
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([
            { status: 'danger', water_level: 40 }
        ]);
        await expect(autoApproveService.verifySensorInArea(10.77, 106.7)).resolves.toBe(true);
    });
});
