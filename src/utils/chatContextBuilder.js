/**
 * Gói ngữ cảnh tổng quan cho Gemini — sensor + báo cáo người dân.
 */
function buildChatContext(sensorList, crowdReportList = [], options = {}) {
    const sensors = Array.isArray(sensorList) ? sensorList : [];
    const crowdReports = Array.isArray(crowdReportList) ? crowdReportList : [];
    const crowdHours = options.crowd_hours ?? 24;
    const now = new Date().toISOString();

    const online = sensors.filter((s) => s.du_lieu_kha_dung === true);
    const offlineList = sensors.filter((s) => !s.du_lieu_kha_dung);
    const tatCaOffline = sensors.length > 0 && online.length === 0;

    const byMucDo = {
        'AN TOÀN': 0,
        'CẢNH BÁO': 0,
        'NGUY HIỂM': 0,
        'RẤT NGUY HIỂM': 0
    };
    for (const s of online) {
        const key = s.muc_do_nguy_hiem || 'AN TOÀN';
        if (byMucDo[key] != null) byMucDo[key]++;
    }

    const sorted = [...online].sort((a, b) => (b.muc_nuoc_cm || 0) - (a.muc_nuoc_cm || 0));
    const worst = sorted[0] || null;
    const avgCm =
        online.length > 0
            ? Math.round(
                  (online.reduce((sum, s) => sum + (s.muc_nuoc_cm || 0), 0) / online.length) * 10
              ) / 10
            : null;

    const crowdSorted = [...crowdReports].sort(
        (a, b) => (b.muc_nuoc_uoc_tinh_cm || 0) - (a.muc_nuoc_uoc_tinh_cm || 0)
    );
    const worstCrowd = crowdSorted[0] || null;
    const crossVerifiedCount = crowdReports.filter((r) => r.xac_minh_cheo).length;

    const diem_ngap_nen_tranh = crowdSorted.slice(0, 8).map((r) => ({
        id: r.id,
        muc_ngap_label: r.muc_ngap_label,
        muc_nuoc_uoc_tinh_cm: r.muc_nuoc_uoc_tinh_cm,
        mo_ta: r.mo_ta,
        xac_minh_cheo: r.xac_minh_cheo,
        toa_do: r.toa_do,
        thoi_gian: r.thoi_gian
    }));

    let danh_gia_chung;
    if (tatCaOffline && crowdReports.length === 0) {
        danh_gia_chung =
            'Chưa có số liệu ngập realtime — toàn bộ trạm cảm biến đang mất kết nối và chưa có báo cáo người dân gần đây.';
    } else if (byMucDo['RẤT NGUY HIỂM'] > 0 || (worst && worst.muc_nuoc_cm >= 60)) {
        danh_gia_chung = 'Rất căng thẳng — có khu vực ngập sâu, hạn chế di chuyển.';
    } else if (
        byMucDo['NGUY HIỂM'] > 0 ||
        (worst && worst.muc_nuoc_cm >= 30) ||
        (worstCrowd && worstCrowd.muc_nuoc_uoc_tinh_cm >= 30)
    ) {
        danh_gia_chung = 'Cảnh báo cao — nhiều đoạn ngập đáng kể (cảm biến và/hoặc báo cáo người dân).';
    } else if (
        byMucDo['CẢNH BÁO'] > 0 ||
        (worst && worst.muc_nuoc_cm >= 10) ||
        crowdReports.length > 0
    ) {
        danh_gia_chung = 'Cần thận trọng — có điểm ngập tại một số khu vực.';
    } else {
        danh_gia_chung = 'Ổn định — các trạm online đang ở mức an toàn, ít báo cáo ngập gần đây.';
    }

    const diem_can_chu_y = sorted.slice(0, 3).map((s) => ({
        khu_vuc: s.khu_vuc,
        muc_nuoc_cm: s.muc_nuoc_cm,
        muc_do: s.muc_do_nguy_hiem
    }));

    return {
        he_thong: {
            ten: 'FloodSight',
            mo_ta: 'Giám sát ngập lụt TP.HCM — cảm biến IoT, báo cáo người dân, bản đồ, lộ trình an toàn.',
            luu_y:
                'Sensor: chỉ dùng tram_co_du_lieu cho số cm đo thực. Báo cáo người dân: chỉ bao_cao_nguoi_dan.da_duyet (mức Mức 1–5 / cm ước tính). Không bịa tên đường nếu không có trong mo_ta hoặc dữ liệu.'
        },
        cap_nhat_luc: now,
        tong_quan: {
            tong_tram: sensors.length,
            tram_online: online.length,
            tram_offline: offlineList.length,
            tat_ca_offline: tatCaOffline,
            do_tin_cay_du_lieu: tatCaOffline ? 'không có' : online.length < sensors.length ? 'một phần' : 'đầy đủ',
            muc_nuoc_trung_binh_cm: avgCm,
            phan_bo_muc_do: tatCaOffline ? null : byMucDo,
            danh_gia_chung
        },
        bao_cao_nguoi_dan: {
            cua_so_gio: crowdHours,
            tong_bao_cao_da_duyet: crowdReports.length,
            bao_cao_xac_minh_cheo: crossVerifiedCount,
            diem_ngap_nen_tranh,
            bao_cao_chi_tiet: crowdReports.slice(0, 15),
            quy_uoc_muc: {
                'Mức 1': '10 cm',
                'Mức 2': '20 cm',
                'Mức 3': '30 cm',
                'Mức 4': '40 cm',
                'Mức 5': 'trên 50 cm (ước tính 55 cm)'
            }
        },
        diem_ngap_dang_luu_y: diem_can_chu_y,
        khu_vuc_ngap_nhat: worst
            ? {
                  khu_vuc: worst.khu_vuc,
                  muc_nuoc_cm: worst.muc_nuoc_cm,
                  muc_do: worst.muc_do_nguy_hiem
              }
            : null,
        tram_offline_ten_khu_vuc: offlineList.map((s) => s.khu_vuc),
        tram_co_du_lieu: online,
        nguong_cm: { an_toan: '<10', canh_bao: '10-30', nguy_hiem: '30-60', rat_nguy_hiem: '>60' }
    };
}

module.exports = { buildChatContext };
