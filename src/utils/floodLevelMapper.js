const VALID_LEVELS = ['Nhẹ', 'Trung bình', 'Nặng'];

/**
 * Map mô tả tự nhiên / enum → mức báo cáo crowd_reports.
 */
function mapFloodLevel(input) {
    if (input == null || input === '') return null;
    const raw = String(input).trim();
    if (VALID_LEVELS.includes(raw)) return raw;

    const s = raw.toLowerCase();
    if (/rất nguy|rat nguy|ngập sâu|ngap sau|sâu|sau|nặng|nang|nguy hiểm|nguy hiem|critical|severe/.test(s)) {
        return 'Nặng';
    }
    if (/trung bình|trung binh|vừa|vua|medium|moderate|cảnh báo|canh bao/.test(s)) {
        return 'Trung bình';
    }
    if (/nhẹ|nhe|ít ngập|it ngap|light|minor/.test(s)) {
        return 'Nhẹ';
    }
    return null;
}

module.exports = { VALID_LEVELS, mapFloodLevel };
