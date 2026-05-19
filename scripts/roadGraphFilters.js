'use strict';

/** Loại đường bỏ qua khi import Neon free (giảm dung lượng). */
const HIGHWAY_SKIP = new Set([
    'footway',
    'path',
    'steps',
    'pedestrian',
    'cycleway',
    'track',
    'corridor',
    'bridleway',
    'escape',
    'raceway',
    'proposed',
    'construction',
]);

/** trunk..tertiary (+ link) — nhỏ hơn, phù hợp Neon free */
const HIGHWAY_ARTERIAL = new Set([
    'motorway',
    'motorway_link',
    'trunk',
    'trunk_link',
    'primary',
    'primary_link',
    'secondary',
    'secondary_link',
    'tertiary',
    'tertiary_link',
]);

/** major = arterial + residential (lớn hơn) */
const HIGHWAY_MAJOR = new Set([...HIGHWAY_ARTERIAL, 'unclassified', 'living_street', 'residential']);

function parseBbox(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const p = raw.split(',').map((s) => Number(s.trim()));
    if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
    const [minLng, minLat, maxLng, maxLat] = p;
    return { minLng, minLat, maxLng, maxLat };
}

/** Bbox mặc định: vùng quanh S01–S03 (TP.HCM, trung tâm ngập demo). */
const DEFAULT_BBOX = { minLng: 106.64, minLat: 10.76, maxLng: 106.78, maxLat: 10.9 };

function inBbox(lng, lat, bbox) {
    return lng >= bbox.minLng && lng <= bbox.maxLng && lat >= bbox.minLat && lat <= bbox.maxLat;
}

function segmentInBbox(from, to, bbox) {
    return (
        inBbox(from.lng, from.lat, bbox) ||
        inBbox(to.lng, to.lat, bbox) ||
        inBbox((from.lng + to.lng) / 2, (from.lat + to.lat) / 2, bbox)
    );
}

function normalizeHighway(props) {
    const h = props?.highway || props?.road_type;
    return h ? String(h).toLowerCase() : '';
}

function highwayAllowed(hw, mode) {
    if (!hw || HIGHWAY_SKIP.has(hw)) return false;
    if (mode === 'arterial') return HIGHWAY_ARTERIAL.has(hw);
    if (mode === 'major') return HIGHWAY_MAJOR.has(hw);
    if (mode === 'all') return true;
    return !HIGHWAY_SKIP.has(hw);
}

function featurePassesFilters(feature, { bbox, highwayMode }) {
    const hw = normalizeHighway(feature?.properties || {});
    if (!highwayAllowed(hw, highwayMode)) return false;
    if (!bbox) return true;
    const geom = feature?.geometry;
    if (!geom) return false;
    const checkCoord = (lng, lat) => inBbox(Number(lng), Number(lat), bbox);
    const checkLine = (coords) => {
        if (!Array.isArray(coords) || coords.length < 2) return false;
        for (let i = 1; i < coords.length; i++) {
            const [lng1, lat1] = coords[i - 1];
            const [lng2, lat2] = coords[i];
            if (
                checkCoord(lng1, lat1) ||
                checkCoord(lng2, lat2) ||
                checkCoord((lng1 + lng2) / 2, (lat1 + lat2) / 2)
            ) {
                return true;
            }
        }
        return false;
    };
    if (geom.type === 'LineString') return checkLine(geom.coordinates);
    if (geom.type === 'MultiLineString') {
        return (geom.coordinates || []).some((ls) => checkLine(ls));
    }
    return false;
}

module.exports = {
    HIGHWAY_SKIP,
    HIGHWAY_ARTERIAL,
    HIGHWAY_MAJOR,
    DEFAULT_BBOX,
    parseBbox,
    segmentInBbox,
    highwayAllowed,
    normalizeHighway,
    featurePassesFilters,
};
