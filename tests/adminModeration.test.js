/**
 * Kiểm thử chức năng 2.2 — Kiểm duyệt báo cáo (Admin Moderation).
 *
 * Nghiệp vụ: Admin xem báo cáo, nhấn "Phê duyệt" → điểm ngập hiện lên bản đồ chung.
 * Cách test (không cần DB thật):
 *   - Mock BaseRepository.prototype.query để mô phỏng vòng đời 1 báo cáo:
 *       state pending → admin duyệt → state approved.
 *   - Sau khi duyệt, gọi `getRecentReports(moderation_status='approved')`
 *     (chính là query mà API public dùng cho bản đồ user khác)
 *     → phải trả về báo cáo vừa duyệt, kèm lat/lng (ST_X/ST_Y) đúng.
 *   - Kiểm tra controller xử lý 'approve' / 'reject' đúng, và lỗi 400/404
 *     khi đầu vào không hợp lệ / không tồn tại.
 */
const BaseRepository = require('../src/repositories/baseRepository');
const crowdReportRepository = require('../src/repositories/crowdReportRepository');
const reportModerationController = require('../src/controllers/reportModerationController');
const userModel = require('../src/models/userModel');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function makeReportRow(overrides = {}) {
    return {
        id: 42,
        reporter_name: 'Nguyen Van A',
        reporter_id: '7',
        flood_level: 'Trung bình',
        reliability_score: 50,
        validation_status: 'pending',
        verified_by_sensor: false,
        photo_url: 'https://cdn/uploads/r42.jpg',
        content: 'Ngập đến đầu gối',
        photo_urls: ['https://cdn/uploads/r42.jpg'],
        moderation_status: 'pending',
        moderated_by: null,
        moderated_by_name: null,
        moderated_at: null,
        rejection_reason: null,
        lng: 106.7008,
        lat: 10.7765,
        created_at: new Date('2026-05-13T03:00:00Z'),
        ...overrides,
    };
}

describe('Admin Moderation 2.2 — duyệt báo cáo + hiển thị cho user khác', () => {
    /**
     * @type {Map<number, object>}  Mô phỏng "bảng" crowd_reports trong RAM.
     */
    let storage;
    let querySpy;

    beforeEach(() => {
        storage = new Map();
        storage.set(42, makeReportRow());

        querySpy = jest.spyOn(BaseRepository.prototype, 'query').mockImplementation(
            async (sql, params = []) => {
                const s = String(sql);

                if (/SELECT[\s\S]+FROM crowd_reports[\s\S]+WHERE cr\.id\s*=\s*\$1/i.test(s)) {
                    const row = storage.get(params[0]);
                    if (!row) return [];
                    const moderatorNames = { 99: 'Moderator Test' };
                    return [{
                        ...row,
                        moderated_by_name: row.moderated_by
                            ? moderatorNames[row.moderated_by] || null
                            : null
                    }];
                }

                if (/UPDATE crowd_reports[\s\S]+SET moderation_status\s*=\s*\$1/i.test(s)) {
                    const [moderationStatus, moderatorId, rejectionReason, reportId] = params;
                    const existing = storage.get(reportId);
                    if (!existing) return [];
                    const updated = {
                        ...existing,
                        moderation_status: moderationStatus,
                        moderated_by: moderatorId,
                        moderated_at: new Date('2026-05-13T03:30:00Z'),
                        rejection_reason: rejectionReason || null,
                    };
                    storage.set(reportId, updated);
                    return [updated];
                }

                if (/FROM crowd_reports[\s\S]+WHERE cr\.created_at > NOW/i.test(s)) {
                    let modStatus = null;
                    let valStatus = null;
                    let idx = 0;
                    if (/AND cr\.moderation_status = \$\d+/i.test(s)) modStatus = params[idx++];
                    if (/AND validation_status = \$\d+/i.test(s)) valStatus = params[idx++];

                    return Array.from(storage.values()).filter((r) => {
                        if (modStatus && r.moderation_status !== modStatus) return false;
                        if (valStatus && r.validation_status !== valStatus) return false;
                        return true;
                    });
                }

                return [];
            },
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Duyệt approve → moderation_status đổi thành "approved", có moderated_by/moderated_at', async () => {
        const updated = await crowdReportRepository.moderateReport(
            42,
            'approved',
            99,
            null,
        );
        expect(updated.moderation_status).toBe('approved');
        expect(updated.moderated_by).toBe(99);
        expect(updated.moderated_by_name).toBe('Moderator Test');
        expect(updated.moderated_at).toBeInstanceOf(Date);
        expect(storage.get(42).moderation_status).toBe('approved');
    });

    test('Sau khi duyệt → bản đồ user khác (getRecentReports approved) THẤY điểm ngập', async () => {
        // Trước khi duyệt: báo cáo chưa approved → user khác KHÔNG thấy
        const beforeApprove = await crowdReportRepository.getRecentReports(24, 'approved');
        expect(beforeApprove).toHaveLength(0);

        // Admin duyệt
        await crowdReportRepository.moderateReport(42, 'approved', 99, null);

        // Sau khi duyệt: bản đồ public (filter moderation_status=approved) phải thấy điểm
        const visible = await crowdReportRepository.getRecentReports(24, 'approved');
        expect(visible).toHaveLength(1);
        const point = visible[0];
        expect(point.id).toBe(42);
        expect(point.moderation_status).toBe('approved');
        expect(point.lng).toBeCloseTo(106.7008, 4);
        expect(point.lat).toBeCloseTo(10.7765, 4);
        expect(point.photo_url).toBe('https://cdn/uploads/r42.jpg');
    });

    test('Reject report → KHÔNG xuất hiện trên bản đồ public (filter approved)', async () => {
        await crowdReportRepository.moderateReport(42, 'rejected', 99, 'Ảnh không rõ');
        const visible = await crowdReportRepository.getRecentReports(24, 'approved');
        expect(visible).toHaveLength(0);
        expect(storage.get(42).moderation_status).toBe('rejected');
        expect(storage.get(42).rejection_reason).toBe('Ảnh không rõ');
    });
});

describe('Admin Moderation 2.2 — Controller validate action + 404', () => {
    beforeEach(() => {
        jest.spyOn(userModel, 'applyReporterReliabilityEvent').mockResolvedValue(undefined);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Action không hợp lệ → 400', async () => {
        const req = { params: { reportId: '42' }, body: { action: 'wat' }, user: { id: 99, username: 'admin' } };
        const res = mockRes();
        await reportModerationController.moderateReport(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].error).toMatch(/approve.+reject/i);
    });

    test('reportId không phải số → 400', async () => {
        const req = { params: { reportId: 'abc' }, body: { action: 'approve' }, user: { id: 99, username: 'admin' } };
        const res = mockRes();
        await reportModerationController.moderateReport(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].error).toMatch(/reportId/);
    });

    test('Report không tồn tại → 404', async () => {
        jest.spyOn(crowdReportRepository, 'getReportById').mockResolvedValueOnce(null);
        const req = { params: { reportId: '999' }, body: { action: 'approve' }, user: { id: 99, username: 'admin' } };
        const res = mockRes();
        await reportModerationController.moderateReport(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json.mock.calls[0][0].error).toMatch(/không tồn tại/i);
    });

    test('Approve thành công → controller gọi repo.moderateReport với "approved" + moderator id', async () => {
        jest.spyOn(crowdReportRepository, 'getReportById').mockResolvedValueOnce(makeReportRow());
        const moderateSpy = jest
            .spyOn(crowdReportRepository, 'moderateReport')
            .mockResolvedValueOnce(makeReportRow({ moderation_status: 'approved', moderated_by: 99 }));

        const req = {
            params: { reportId: '42' },
            body: { action: 'approve' },
            user: { id: 99, username: 'admin' },
            // req helpers cần cho withFullPhotoUrls(req, ...)
            protocol: 'https',
            get: () => 'api.floodsight.id.vn',
        };
        const res = mockRes();

        await reportModerationController.moderateReport(req, res);

        expect(moderateSpy).toHaveBeenCalledWith(42, 'approved', 99, undefined);
        expect(res.json).toHaveBeenCalledTimes(1);
        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        expect(body.message).toMatch(/duyệt/i);
        expect(body.data.moderation_status).toBe('approved');
    });

    test('Báo cáo đã auto_approved → 409, không cho duyệt/từ chối thủ công', async () => {
        jest.spyOn(crowdReportRepository, 'getReportById').mockResolvedValueOnce(
            makeReportRow({ moderation_status: 'approved', auto_approved: true })
        );
        const moderateSpy = jest.spyOn(crowdReportRepository, 'moderateReport');

        const req = {
            params: { reportId: '42' },
            body: { action: 'reject' },
            user: { id: 99, username: 'admin' },
            protocol: 'https',
            get: () => 'api.floodsight.id.vn',
        };
        const res = mockRes();

        await reportModerationController.moderateReport(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json.mock.calls[0][0].error).toMatch(/tự động duyệt/i);
        expect(moderateSpy).not.toHaveBeenCalled();
    });
});
