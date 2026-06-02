/**
 * Google Places Autocomplete + Place Details + (tuỳ chọn) Geocoding forward.
 * Dùng cho FE: gợi ý địa chỉ tiếng Việt có dấu, chi tiết tới số nhà (Places tốt hơn Geocoding forward thuần).
 * @see https://developers.google.com/maps/documentation/places/web-service/autocomplete
 * @see https://developers.google.com/maps/documentation/places/web-service/details
 */

/** Tâm TP.HCM — bias Places Autocomplete cho chat agent */
const HCM_CENTER = { lat: 10.7769, lng: 106.7009 };

function getApiKey() {
    const k =
        String(process.env.GOOGLE_PLACES_API_KEY || '').trim() ||
        String(process.env.GOOGLE_GEOCODING_API_KEY || '').trim();
    return k;
}

function appendHcmSuffix(address) {
    const a = String(address || '').trim();
    if (/TP\.?\s*HCM|Hồ Chí Minh|Ho Chi Minh|Vietnam/i.test(a)) return a.slice(0, 512);
    return `${a}, TP. Hồ Chí Minh, Vietnam`.slice(0, 512);
}

/** Các biến thể chuỗi cho Geocoding forward (hẻm/ngõ thường ZERO_RESULTS). */
function buildGeocodeVariants(locationText) {
    const base = String(locationText || '').trim();
    const seen = new Set();
    const out = [];

    function add(s) {
        const v = appendHcmSuffix(s);
        if (v.length >= 3 && !seen.has(v)) {
            seen.add(v);
            out.push(v);
        }
    }

    add(base);

    const noPhuong = base.replace(/,?\s*Phường\s+[^,]+/gi, ',').replace(/\s*,\s*,/g, ',').trim();
    if (noPhuong.length >= 5) add(noPhuong);

    const hemMatch = base.match(/Hẻm\s*\d+[^,]*/i);
    const quanMatch = base.match(/Quận\s+[^,]+/i);
    if (hemMatch && quanMatch) add(`${hemMatch[0]}, ${quanMatch[0]}`);

    const noHem = base.replace(/Hẻm\s*\d+\s*/i, '').replace(/,?\s*Phường\s+[^,]+/gi, ',').trim();
    if (noHem.length >= 8) add(noHem);

    const streetChunk = base
        .replace(/^[^,]*,\s*/g, '')
        .replace(/,?\s*Phường\s+[^,]+/gi, '')
        .trim();
    if (streetChunk.length >= 6 && streetChunk !== base) add(streetChunk);

    return out;
}

/** Truy vấn Places Autocomplete (tốt hơn forward cho địa chỉ VN chi tiết). */
function buildPlacesSearchQueries(locationText) {
    const base = String(locationText || '').trim();
    const seen = new Set();
    const out = [];

    function add(s) {
        const v = String(s || '').trim().slice(0, 256);
        if (v.length >= 3 && !seen.has(v)) {
            seen.add(v);
            out.push(v);
        }
    }

    add(base);
    add(base.replace(/,?\s*Phường\s+[^,]+/gi, ',').replace(/\s*,\s*,/g, ',').trim());

    const hem = base.match(/Hẻm\s*\d+[^,]*/i);
    const quan = base.match(/Quận\s+[^,]+/i);
    if (hem) add(`${hem[0]} ${quan ? quan[0] : 'TP HCM'}`);

    const road = base.match(
        /(\d+\s+)?[A-Za-zÀ-ỹ0-9\s]+(?:Nghệ Tĩnh|Tĩnh|Nguyễn|Lê|Võ|Đường|đường)[^,]*/i
    );
    if (road) add(`${road[0]} ${quan ? quan[0] : 'Bình Thạnh TP HCM'}`);

    return out;
}

function isLikelyHcm(lat, lng) {
    return lat >= 10.35 && lat <= 10.95 && lng >= 106.35 && lng <= 107.05;
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

/**
 * Geocoding reverse (lat/lng -> địa chỉ).
 */
async function geocodeReverse(lat, lng) {
    const key = getApiKey();
    if (!key) {
        throw new Error('Chưa cấu hình GOOGLE_PLACES_API_KEY hoặc GOOGLE_GEOCODING_API_KEY');
    }
    const params = {
        latlng: `${Number(lat)},${Number(lng)}`,
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
        throw new Error(`Google Reverse Geocoding: phản hồi không phải JSON (${rsp.status})`);
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

function coordsFromGeocodeResult(row) {
    const loc = row?.geometry?.location;
    if (loc?.lat == null || loc?.lng == null) return null;
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!isLikelyHcm(lat, lng)) return null;
    return {
        lat,
        lng,
        formatted_address: row.formatted_address || null,
        place_id: row.place_id || null,
        source: 'geocode'
    };
}

/**
 * Resolve địa chỉ → lat/lng: Geocoding forward (nhiều biến thể) rồi Places Autocomplete + Details.
 * Dùng cho chat agent Hướng B.
 */
async function resolveAddressToCoords(locationText) {
    const address = String(locationText || '').trim();
    if (address.length < 3) {
        return { ok: false, error: 'Địa chỉ quá ngắn', lat: null, lng: null, formatted_address: null };
    }

    if (!getApiKey()) {
        return {
            ok: false,
            error: 'Server chưa cấu hình GOOGLE_PLACES_API_KEY hoặc GOOGLE_GEOCODING_API_KEY',
            code: 'NO_GEOCODE_KEY',
            lat: null,
            lng: null,
            formatted_address: null
        };
    }

    let lastStatus = null;
    let lastError = null;

    for (const variant of buildGeocodeVariants(address)) {
        try {
            const data = await geocodeForward(variant);
            lastStatus = data.status;
            lastError = data.error_message || null;
            if (data.status === 'REQUEST_DENIED') {
                return {
                    ok: false,
                    error: data.error_message || 'Google Geocoding bị từ chối (kiểm tra API key / bật Geocoding API)',
                    code: 'REQUEST_DENIED',
                    lat: null,
                    lng: null,
                    formatted_address: null
                };
            }
            if (data.status === 'OK' && data.results?.length) {
                for (const row of data.results.slice(0, 3)) {
                    const hit = coordsFromGeocodeResult(row);
                    if (hit) {
                        return { ok: true, error: null, ...hit };
                    }
                }
            }
        } catch (err) {
            lastError = err.message;
        }
    }

    for (const query of buildPlacesSearchQueries(address)) {
        try {
            const ac = await placeAutocomplete(query, {
                lat: HCM_CENTER.lat,
                lng: HCM_CENTER.lng,
                radiusM: 35000
            });
            lastStatus = ac.status;
            lastError = ac.error_message || null;
            if (ac.status === 'REQUEST_DENIED') {
                return {
                    ok: false,
                    error:
                        ac.error_message ||
                        'Google Places bị từ chối (bật Places API + Geocoding trên cùng key)',
                    code: 'REQUEST_DENIED',
                    lat: null,
                    lng: null,
                    formatted_address: null
                };
            }
            const pred = ac.predictions?.[0];
            if (!pred?.place_id) continue;

            const det = await placeDetails(pred.place_id);
            if (det.status !== 'OK' || !det.result?.geometry?.location) continue;

            const loc = det.result.geometry.location;
            const lat = Number(loc.lat);
            const lng = Number(loc.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isLikelyHcm(lat, lng)) continue;

            return {
                ok: true,
                error: null,
                lat,
                lng,
                formatted_address: det.result.formatted_address || pred.description || address,
                place_id: det.result.place_id || pred.place_id,
                source: 'places'
            };
        } catch (err) {
            lastError = err.message;
        }
    }

    console.warn(
        '[geocode] resolve failed:',
        address.slice(0, 80),
        'status=',
        lastStatus,
        lastError || ''
    );

    return {
        ok: false,
        error:
            lastStatus === 'ZERO_RESULTS' || !lastStatus
                ? 'Không tìm thấy tọa độ cho địa chỉ này (thử đường chính hoặc chọn trên bản đồ)'
                : lastError || `Google: ${lastStatus}`,
        code: 'NOT_FOUND',
        lat: null,
        lng: null,
        formatted_address: null
    };
}

module.exports = {
    getApiKey,
    HCM_CENTER,
    placeAutocomplete,
    placeDetails,
    geocodeForward,
    geocodeReverse,
    resolveAddressToCoords,
    mapPrediction
};
