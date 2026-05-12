/**
 * Google Places Autocomplete + Place Details + (tuỳ chọn) Geocoding forward.
 * Dùng cho FE: gợi ý địa chỉ tiếng Việt có dấu, chi tiết tới số nhà (Places tốt hơn Geocoding forward thuần).
 * @see https://developers.google.com/maps/documentation/places/web-service/autocomplete
 * @see https://developers.google.com/maps/documentation/places/web-service/details
 */

function getApiKey() {
    const k =
        String(process.env.GOOGLE_PLACES_API_KEY || '').trim() ||
        String(process.env.GOOGLE_GEOCODING_API_KEY || '').trim();
    return k;
}

function buildUrl(path, params) {
    const u = new URL(`https://maps.googleapis.com/maps/api${path}`);
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        u.searchParams.set(k, String(v));
    }
    return u.toString();
}

/**
 * @param {string} input
 * @param {{ sessionToken?: string, lat?: number, lng?: number, radiusM?: number }} opts
 */
async function placeAutocomplete(input, opts = {}) {
    const key = getApiKey();
    if (!key) {
        throw new Error('Chưa cấu hình GOOGLE_PLACES_API_KEY hoặc GOOGLE_GEOCODING_API_KEY');
    }
    const params = {
        input: String(input).slice(0, 256),
        key,
        language: 'vi',
        components: 'country:vn'
    };
    if (opts.sessionToken) {
        params.sessiontoken = String(opts.sessionToken).slice(0, 120);
    }
    if (opts.lat != null && opts.lng != null && Number.isFinite(+opts.lat) && Number.isFinite(+opts.lng)) {
        params.location = `${+opts.lat},${+opts.lng}`;
        const r = Math.min(50000, Math.max(1, parseInt(opts.radiusM ?? 20000, 10) || 20000));
        params.radius = String(r);
    }

    const url = buildUrl('/place/autocomplete/json', params);
    const rsp = await fetch(url);
    const text = await rsp.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`Google Places Autocomplete: phản hồi không phải JSON (${rsp.status})`);
    }
    return data;
}

/**
 * @param {string} placeId
 * @param {{ sessionToken?: string }} opts
 */
async function placeDetails(placeId, opts = {}) {
    const key = getApiKey();
    if (!key) {
        throw new Error('Chưa cấu hình GOOGLE_PLACES_API_KEY hoặc GOOGLE_GEOCODING_API_KEY');
    }
    const params = {
        place_id: String(placeId).slice(0, 512),
        key,
        language: 'vi',
        fields: 'geometry,formatted_address,name,place_id,types'
    };
    if (opts.sessionToken) {
        params.sessiontoken = String(opts.sessionToken).slice(0, 120);
    }

    const url = buildUrl('/place/details/json', params);
    const rsp = await fetch(url);
    const text = await rsp.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`Google Place Details: phản hồi không phải JSON (${rsp.status})`);
    }
    return data;
}

/**
 * Geocoding forward (địa chỉ chuỗi → lat/lng) — bổ sung khi không dùng place_id.
 */
async function geocodeForward(address) {
    const key = getApiKey();
    if (!key) {
        throw new Error('Chưa cấu hình GOOGLE_PLACES_API_KEY hoặc GOOGLE_GEOCODING_API_KEY');
    }
    const params = {
        address: String(address).slice(0, 512),
        key,
        language: 'vi',
        region: 'vn'
    };
    const url = buildUrl('/geocode/json', params);
    const rsp = await fetch(url);
    const text = await rsp.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`Google Geocoding: phản hồi không phải JSON (${rsp.status})`);
    }
    return data;
}

function mapPrediction(p) {
    if (!p) return null;
    return {
        place_id: p.place_id,
        description: p.description,
        structured_formatting: p.structured_formatting || null,
        types: p.types || [],
        reference: p.reference || null
    };
}

module.exports = {
    getApiKey,
    placeAutocomplete,
    placeDetails,
    geocodeForward,
    mapPrediction
};
