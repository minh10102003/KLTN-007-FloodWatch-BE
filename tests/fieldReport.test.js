/**
 * Kiểm thử chức năng 2.1 — Gửi báo cáo hiện trường.
 *
 * Nghiệp vụ: Người dùng chọn vị trí trên Map, tải ảnh, nhập mô tả và gửi.
 * Cách test (không cần DB thật):
 *   - Mock BaseRepository.prototype.query → bắt được SQL/params mà repository
 *     gửi xuống PostgreSQL.
 *   - Mock sensorRepository.findSensorsInRadius và userRepository.getReporterReliability
 *     để bỏ qua việc gọi DB phụ.
 *   - Gọi `crowdReportRepository.createReport(...)` và xác minh:
 *       (a) INSERT lưu Geometry đúng (ST_SetSRID(ST_MakePoint($4,$5),4326)::geography)
 *           với lng/lat đúng vị trí param,
 *       (b) photo_url và mảng photo_urls (JSONB) được lưu đúng,
 *       (c) các tham số khác (level, reporter_name, reliability) đúng vị trí.
 *   - Kiểm tra controller validate input (lỗi 400 khi thiếu/không hợp lệ).
 */
const BaseRepository = require('../src/repositories/baseRepository');
const crowdReportRepository = require('../src/repositories/crowdReportRepository');
const sensorRepository = require('../src/repositories/sensorRepository');
const userRepository = require('../src/repositories/userRepository');

const crowdReportController = require('../src/controllers/crowdReportController');
const crowdReportModel = require('../src/models/crowdReportModel');
const userModel = require('../src/models/userModel');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('Field Report 2.1 — lưu Geometry + link ảnh xuống DB', () => {
    let querySpy;

    beforeEach(() => {
        querySpy = jest
            .spyOn(BaseRepository.prototype, 'query')
            .mockResolvedValue([
                { id: 4242, validation_status: 'pending', verified_by_sensor: false },
            ]);
        jest.spyOn(sensorRepository, 'findSensorsInRadius').mockResolvedValue([
            { sensor_id: 'S01', water_level: 5, status: 'normal' },
        ]);
        jest.spyOn(userRepository, 'getReporterReliability').mockResolvedValue(50);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('INSERT chứa Geometry PostGIS và lưu lng/lat đúng vị trí param', async () => {
        const lng = 106.7008;
        const lat = 10.7765;
        const photoUrl = 'https://example.com/uploads/r1.jpg';
        const photoUrls = ['https://example.com/uploads/r1.jpg', 'https://example.com/uploads/r2.jpg'];

        const result = await crowdReportRepository.createReport(
            'Nguyen Van A',
            '7',
            'Mức 3',
            lng,
            lat,
            photoUrl,
            'Đường Nguyễn Hữu Cảnh',
            'Ngập đến đầu gối',
            photoUrls,
        );

        expect(result).toEqual({ id: 4242, validation_status: 'pending', verified_by_sensor: false, no_sensor_coverage: false });

        const insertCall = querySpy.mock.calls.find(([sql]) => /INSERT\s+INTO\s+crowd_reports/i.test(sql));
        expect(insertCall).toBeDefined();
        const [sql, params] = insertCall;

        expect(sql).toMatch(/ST_SetSRID\(\s*ST_MakePoint\(\s*\$4\s*,\s*\$5\s*\)\s*,\s*4326\s*\)\s*::\s*geography/i);
        expect(params[0]).toBe('Nguyen Van A');
        expect(params[1]).toBe('7');
        expect(params[2]).toBe('Mức 3');
        expect(params[3]).toBe(lng);
        expect(params[4]).toBe(lat);
        expect(params[5]).toBe(50);
        expect(params[8]).toBe(photoUrl);
        expect(params[9]).toBe('Ngập đến đầu gối');
        const photoUrlsJson = JSON.parse(params[10]);
        expect(photoUrlsJson).toEqual(photoUrls);
    });

    test('Khi chỉ có photo_url (không có photo_urls) → JSONB lưu mảng 1 phần tử', async () => {
        await crowdReportRepository.createReport(
            'Khach Le',
            null,
            'Mức 1',
            106.701,
            10.802,
            'https://cdn/uploads/only.jpg',
            null,
            null,
            null,
        );
        const insertCall = querySpy.mock.calls.find(([sql]) => /INSERT\s+INTO\s+crowd_reports/i.test(sql));
        const params = insertCall[1];
        expect(params[8]).toBe('https://cdn/uploads/only.jpg');
        expect(JSON.parse(params[10])).toEqual(['https://cdn/uploads/only.jpg']);
    });

    test('Không có sensor trong 500m → vẫn lưu DB, skip_auto_approve=true', async () => {
        sensorRepository.findSensorsInRadius.mockResolvedValueOnce([]);
        querySpy.mockClear();
        querySpy.mockResolvedValue([
            { id: 999, validation_status: 'pending', verified_by_sensor: false, moderation_status: 'pending' },
        ]);

        const result = await crowdReportRepository.createReport(
            'A',
            null,
            'Mức 3',
            106.7,
            10.8,
            'https://x/p.jpg',
            null,
            null,
            null,
        );

        expect(result.id).toBe(999);
        expect(result.no_sensor_coverage).toBe(true);

        const insertCall = querySpy.mock.calls.find(([sql]) => /INSERT\s+INTO\s+crowd_reports/i.test(sql));
        expect(insertCall).toBeDefined();
        const params = insertCall[1];
        expect(params[params.length - 1]).toBe(true);
    });
});

describe('Field Report 2.1 — validate đầu vào tại Controller', () => {
    beforeEach(() => {
        jest.spyOn(crowdReportModel, 'createReport').mockResolvedValue({
            id: 99,
            validation_status: 'pending',
            verified_by_sensor: false,
        });
        jest.spyOn(userModel, 'getUserById').mockResolvedValue({
            id: 7,
            username: 'minh',
            full_name: 'Minh Demo',
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Thiếu (level/lng/lat) → 400', async () => {
        const req = { body: { name: 'Khach', level: 'Mức 3' }, user: null };
        const res = mockRes();
        await crowdReportController.createReport(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0]).toMatchObject({ success: false });
        expect(crowdReportModel.createReport).not.toHaveBeenCalled();
    });

    test('Khách (không đăng nhập) không có "name" → 400', async () => {
        const req = {
            body: { level: 'Mức 3', lng: 106.7, lat: 10.8 },
            user: null,
        };
        const res = mockRes();
        await crowdReportController.createReport(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].error).toMatch(/Khách/i);
        expect(crowdReportModel.createReport).not.toHaveBeenCalled();
    });

    test('Quá 5 ảnh → 400', async () => {
        const tooMany = Array.from({ length: 6 }, (_, i) => `https://cdn/p${i}.jpg`);
        const req = {
            body: { name: 'A', level: 'Mức 3', lng: 106.7, lat: 10.8, photo_urls: tooMany },
            user: null,
        };
        const res = mockRes();
        await crowdReportController.createReport(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].error).toMatch(/5 ảnh/);
    });

    test('Đăng nhập + đủ trường + có ảnh → controller truyền đúng (lng, lat, photo_url) vào model', async () => {
        const req = {
            body: {
                level: 'Mức 5',
                lng: 106.7012,
                lat: 10.7758,
                photo_url: 'https://cdn/uploads/main.jpg',
                photo_urls: ['https://cdn/uploads/main.jpg', 'https://cdn/uploads/extra.jpg'],
                content: 'Ngập đến nửa bánh xe',
            },
            user: { id: 7 },
        };
        const res = mockRes();

        await crowdReportController.createReport(req, res);

        expect(crowdReportModel.createReport).toHaveBeenCalledTimes(1);
        const args = crowdReportModel.createReport.mock.calls[0];
        // args: (reporter_name, reporter_id, level, lng, lat, photoUrlFinal, location_description, content, photo_urls)
        expect(args[0]).toBe('Minh Demo');
        expect(args[1]).toBe('7');
        expect(args[2]).toBe('Mức 5');
        expect(args[3]).toBe(106.7012);
        expect(args[4]).toBe(10.7758);
        expect(args[5]).toBe('https://cdn/uploads/main.jpg');
        expect(args[7]).toBe('Ngập đến nửa bánh xe');
        expect(args[8]).toEqual([
            'https://cdn/uploads/main.jpg',
            'https://cdn/uploads/extra.jpg',
        ]);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json.mock.calls[0][0]).toMatchObject({
            success: true,
            data: expect.objectContaining({ id: 99 }),
        });
    });
});
