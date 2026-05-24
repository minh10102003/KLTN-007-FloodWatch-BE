const { buildChatContext } = require('../src/utils/chatContextBuilder');

describe('buildChatContext — báo cáo người dân', () => {
    test('gộp sensor và crowd reports vào JSON context', () => {
        const sensors = [
            {
                khu_vuc: 'Quận 7',
                du_lieu_kha_dung: true,
                muc_nuoc_cm: 25,
                muc_do_nguy_hiem: 'CẢNH BÁO'
            }
        ];
        const crowd = [
            {
                id: 1,
                muc_ngap: 'Mức 5',
                muc_ngap_label: 'Mức 5 - trên 50 cm',
                muc_nuoc_uoc_tinh_cm: 55,
                mo_ta: 'Nguyễn Hữu Thọ ngập sâu',
                xac_minh_cheo: true,
                toa_do: { lat: 10.73, lng: 106.72 },
                thoi_gian: '2026-05-25T10:00:00.000Z'
            }
        ];

        const ctx = buildChatContext(sensors, crowd, { crowd_hours: 24 });

        expect(ctx.bao_cao_nguoi_dan.tong_bao_cao_da_duyet).toBe(1);
        expect(ctx.bao_cao_nguoi_dan.bao_cao_xac_minh_cheo).toBe(1);
        expect(ctx.bao_cao_nguoi_dan.diem_ngap_nen_tranh).toHaveLength(1);
        expect(ctx.bao_cao_nguoi_dan.diem_ngap_nen_tranh[0].mo_ta).toContain('Nguyễn Hữu Thọ');
        expect(ctx.bao_cao_nguoi_dan.quy_uoc_muc['Mức 5']).toBe('trên 50 cm (ước tính 55 cm)');
    });

    test('không có báo cáo vẫn trả cấu trúc bao_cao_nguoi_dan', () => {
        const ctx = buildChatContext([], []);
        expect(ctx.bao_cao_nguoi_dan.tong_bao_cao_da_duyet).toBe(0);
        expect(ctx.bao_cao_nguoi_dan.diem_ngap_nen_tranh).toEqual([]);
    });
});
