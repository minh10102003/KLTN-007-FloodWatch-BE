/**
 * Mức ngập báo cáo người dân — 5 bậc (cm).
 * Giá trị lưu DB (flood_level): Mức 1 … Mức 5
 */

const FLOOD_LEVELS = [
    { key: 'Mức 1', cm: 10, label: 'Mức 1 - 10 cm' },
    { key: 'Mức 2', cm: 20, label: 'Mức 2 - 20 cm' },
    { key: 'Mức 3', cm: 30, label: 'Mức 3 - 30 cm' },
    { key: 'Mức 4', cm: 40, label: 'Mức 4 - 40 cm' },
    { key: 'Mức 5', cm: 55, label: 'Mức 5 - trên 50 cm' }
];

const VALID_LEVELS = FLOOD_LEVELS.map((l) => l.key);

const KEY_BY_NORMALIZED = new Map();
const CM_BY_KEY = new Map();
const LABEL_BY_KEY = new Map();

for (const level of FLOOD_LEVELS) {
    CM_BY_KEY.set(level.key, level.cm);
    LABEL_BY_KEY.set(level.key, level.label);
    KEY_BY_NORMALIZED.set(normalizeToken(level.key), level.key);
    KEY_BY_NORMALIZED.set(normalizeToken(level.label), level.key);
    KEY_BY_NORMALIZED.set(String(level.cm), level.key);
}

/** Legacy 3 mức (Nhẹ / Trung bình / Nặng) và số 1–3 cũ → mức mới */
const LEGACY_TO_KEY = {
    nhe: 'Mức 1',
    nhe2: 'Mức 1',
    light: 'Mức 1',
    mild: 'Mức 1',
    '1': 'Mức 1',
    'trung binh': 'Mức 3',
    'trung bình': 'Mức 3',
    vua: 'Mức 3',
    medium: 'Mức 3',
    moderate: 'Mức 3',
    '2': 'Mức 2',
    '3': 'Mức 3',
    nang: 'Mức 5',
    'nặng': 'Mức 5',
    heavy: 'Mức 5',
    severe: 'Mức 5',
    '4': 'Mức 4',
    '5': 'Mức 5'
};

function normalizeToken(s) {
    return String(s)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

/**
 * Map input (UI / chat / API cũ) → khóa chuẩn Mức 1–5.
 */
function mapFloodLevel(input) {
    if (input == null || input === '') return null;
    const raw = String(input).trim();
    if (VALID_LEVELS.includes(raw)) return raw;

    const norm = normalizeToken(raw);
    if (KEY_BY_NORMALIZED.has(norm)) return KEY_BY_NORMALIZED.get(norm);
    if (LEGACY_TO_KEY[norm]) return LEGACY_TO_KEY[norm];

    // "muc 1", "mức 1 - 10 cm"
    const mucMatch = norm.match(/muc\s*(\d)/);
    if (mucMatch) {
        const key = `Mức ${mucMatch[1]}`;
        if (VALID_LEVELS.includes(key)) return key;
    }

    const s = norm;
    if (/rat nguy|ngap sau|sau|rat nang|nguy hiem|critical/.test(s)) return 'Mức 5';
    if (/nang|ngap nang|heavy|severe/.test(s)) return 'Mức 5';
    if (/muc 5|tren 50|> ?50/.test(s)) return 'Mức 5';
    if (/muc 4|40\s*cm/.test(s)) return 'Mức 4';
    if (/trung binh|vua|medium|moderate|muc 3|30\s*cm/.test(s)) return 'Mức 3';
    if (/muc 2|20\s*cm/.test(s)) return 'Mức 2';
    if (/nhe|it ngap|light|minor|muc 1|10\s*cm/.test(s)) return 'Mức 1';

    return null;
}

function floodLevelToCm(level) {
    if (level == null) return 0;
    const mapped = mapFloodLevel(level) || level;
    if (CM_BY_KEY.has(mapped)) return CM_BY_KEY.get(mapped);
    const legacy = LEGACY_TO_KEY[normalizeToken(mapped)];
    if (legacy && CM_BY_KEY.has(legacy)) return CM_BY_KEY.get(legacy);
    return 0;
}

function getFloodLevelLabel(level) {
    const mapped = mapFloodLevel(level) || level;
    return LABEL_BY_KEY.get(mapped) || mapped;
}

/**
 * Biểu thức SQL CASE … END chuyển flood_level → cm (hỗ trợ legacy).
 * @param {string} columnRef - vd: cr.flood_level
 */
function sqlFloodLevelToCm(columnRef = 'flood_level') {
    const whenLines = [];
    for (const level of FLOOD_LEVELS) {
        whenLines.push(`WHEN ${columnRef} = '${level.key}' THEN ${level.cm}`);
    }
    whenLines.push(`WHEN ${columnRef} = 'Nhẹ' THEN 10`);
    whenLines.push(`WHEN ${columnRef} = 'Trung bình' THEN 30`);
    whenLines.push(`WHEN ${columnRef} = 'Nặng' THEN 50`);
    for (let i = 1; i <= 5; i++) {
        whenLines.push(`WHEN ${columnRef} = '${i}' THEN ${FLOOD_LEVELS[i - 1].cm}`);
    }
    return `CASE ${whenLines.join(' ')} ELSE 0 END`;
}

/**
 * CASE dùng cho routing penalty (LOWER TRIM, legacy + mức mới).
 */
function sqlFloodLevelToCmLowerTrim(columnRef = 'flood_level') {
    const lines = [];
    for (const level of FLOOD_LEVELS) {
        const token = normalizeToken(level.key).replace(/'/g, "''");
        lines.push(`WHEN LOWER(TRIM(${columnRef})) IN ('${token}', 'muc ${level.key.slice(-1)}') THEN ${level.cm}`);
    }
    lines.push(`WHEN LOWER(TRIM(${columnRef})) IN ('nhẹ', 'nhe', 'light', 'mild', '1') THEN 10`);
    lines.push(`WHEN LOWER(TRIM(${columnRef})) IN ('trung bình', 'trung binh', 'medium', 'moderate', '3') THEN 30`);
    lines.push(`WHEN LOWER(TRIM(${columnRef})) IN ('nặng', 'nang', 'heavy', 'severe', '5') THEN 55`);
    lines.push(`WHEN LOWER(TRIM(${columnRef})) IN ('2') THEN 20`);
    lines.push(`WHEN LOWER(TRIM(${columnRef})) IN ('4') THEN 40`);
    return `CASE ${lines.join(' ')} ELSE NULL END`;
}

module.exports = {
    FLOOD_LEVELS,
    VALID_LEVELS,
    mapFloodLevel,
    floodLevelToCm,
    getFloodLevelLabel,
    sqlFloodLevelToCm,
    sqlFloodLevelToCmLowerTrim
};
