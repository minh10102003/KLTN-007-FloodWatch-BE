/**
 * Mức nguy hiểm theo cm (dùng cho chatbot / hiển thị).
 */
function mucDoNguyHiemFromCm(mucNuocCm) {
    const cm = Number(mucNuocCm);
    if (!Number.isFinite(cm) || cm < 0) return 'AN TOÀN';
    if (cm < 10) return 'AN TOÀN';
    if (cm < 30) return 'CẢNH BÁO';
    if (cm < 60) return 'NGUY HIỂM';
    return 'RẤT NGUY HIỂM';
}

module.exports = { mucDoNguyHiemFromCm };
