const { mapRowToChatCrowdReport } = require('../src/repositories/chatRepository');

describe('mapRowToChatCrowdReport', () => {
    test('map báo cáo đã duyệt sang format chat', () => {
        const row = {
            id: 99,
            flood_level: 'Mức 3',
            content: 'Đường Nguyễn Văn Linh ngập',
            validation_status: 'cross_verified',
            verified_by_sensor: true,
            auto_approved: false,
            reliability_score: 80,
            lat: '10.77',
            lng: '106.70',
            created_at: '2026-05-25T08:00:00.000Z'
        };

        const mapped = mapRowToChatCrowdReport(row);
        expect(mapped.muc_ngap_label).toBe('Mức 3 - 30 cm');
        expect(mapped.muc_nuoc_uoc_tinh_cm).toBe(30);
        expect(mapped.xac_minh_cheo).toBe(true);
        expect(mapped.mo_ta).toContain('Nguyễn Văn Linh');
    });
});
