/**
 * Gói ngữ cảnh tổng quan cho Gemini — không dump raw flood_logs.
 */
function buildChatContext(sensorList) {
    const sensors = Array.isArray(sensorList) ? sensorList : [];
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

    let danh_gia_chung;
    if (tatCaOffline) {
        danh_gia_chung =
            'Chưa có số liệu ngập realtime — toàn bộ trạm cảm biến đang mất kết nối.';
    } else if (byMucDo['RẤT NGUY HIỂM'] > 0 || (worst && worst.muc_nuoc_cm >= 60)) {
        danh_gia_chung = 'Rất căng thẳng — có khu vực ngập sâu, hạn chế di chuyển.';
    } else if (byMucDo['NGUY HIỂM'] > 0 || (worst && worst.muc_nuoc_cm >= 30)) {
        danh_gia_chung = 'Cảnh báo cao — nhiều đoạn ngập đáng kể.';
    } else if (byMucDo['CẢNH BÁO'] > 0 || (worst && worst.muc_nuoc_cm >= 10)) {
        danh_gia_chung = 'Cần thận trọng — ngập nhẹ tại một số điểm.';
    } else {
        danh_gia_chung = 'Ổn định — các trạm online đang ở mức an toàn.';
    }

    const diem_can_chu_y = sorted.slice(0, 3).map((s) => ({
        khu_vuc: s.khu_vuc,
        muc_nuoc_cm: s.muc_nuoc_cm,
        muc_do: s.muc_do_nguy_hiem
    }));

    return {
        he_thong: {
            ten: 'FloodSight',
            mo_ta: 'Giám sát ngập lụt TP.HCM — cảm biến IoT, bản đồ, cảnh báo, lộ trình an toàn.',
            luu_y: 'Số liệu cm/mức độ chỉ lấy từ tram_co_du_lieu; có thể kết hợp tư vấn kênh chính thống TP.HCM (xem system prompt).'
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
