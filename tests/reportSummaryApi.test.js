/**
 * Kiểm thử GET /api/reports/summary — đúng format JSON.
 */
const reportSummaryController = require('../src/controllers/reportSummaryController');
const crowdReportAutoApproveRepository = require('../src/repositories/crowdReportAutoApproveRepository');

const EXPECTED_KEYS = [
    'total_active',
    'auto_approved',
    'pending_manual_review',
    'sensor_verified',
    'pending_auto_approve'
];

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('GET /api/reports/summary — JSON format', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('trả success + data với đúng 5 key số', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getSummaryStats').mockResolvedValue({
            total_active: 120,
            auto_approved: 15,
            pending_manual_review: 8,
            sensor_verified: 22,
            pending_auto_approve: 4
        });

        const req = { user: { id: 1, role: 'admin', username: 'admin' } };
        const res = mockRes();

        await reportSummaryController.getSummary(req, res);

        expect(res.json).toHaveBeenCalledTimes(1);
        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();

        for (const key of EXPECTED_KEYS) {
            expect(body.data).toHaveProperty(key);
            expect(typeof body.data[key]).toBe('number');
        }

        expect(body.data).toEqual({
            total_active: 120,
            auto_approved: 15,
            pending_manual_review: 8,
            sensor_verified: 22,
            pending_auto_approve: 4
        });
    });

    test('khi DB trả null → các chỉ số mặc định 0', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getSummaryStats').mockResolvedValue(null);

        const res = mockRes();
        await reportSummaryController.getSummary({}, res);

        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        EXPECTED_KEYS.forEach((key) => {
            expect(body.data[key]).toBe(0);
        });
    });

    test('lỗi DB → 500', async () => {
        jest.spyOn(crowdReportAutoApproveRepository, 'getSummaryStats').mockRejectedValue(
            new Error('connection failed')
        );

        const res = mockRes();
        await reportSummaryController.getSummary({}, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].success).toBe(false);
    });
});
