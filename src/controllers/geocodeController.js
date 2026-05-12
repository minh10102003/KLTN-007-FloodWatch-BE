const googlePlacesGeocodeService = require('../services/googlePlacesGeocodeService');

function parseNum(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

const geocodeController = {
    /**
     * GET /api/v1/geocode/search?q=... hoặc ?input=...
     * Gợi ý địa điểm (Google Places Autocomplete), ưu tiên VN, tiếng Việt có dấu.
     * Query tuỳ chọn: session_token, lat, lng, radius (mét, mặc định 20000)
     */
    search: async (req, res) => {
        try {
            const raw = req.query.q ?? req.query.input ?? '';
            const input = String(raw).trim();
            if (input.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Tham số q hoặc input phải có ít nhất 2 ký tự'
                });
            }
            if (input.length > 256) {
                return res.status(400).json({
                    success: false,
                    error: 'Chuỗi tìm kiếm quá dài (tối đa 256 ký tự)'
                });
            }

            const lat = parseNum(req.query.lat);
            const lng = parseNum(req.query.lng);
            const radiusM = parseNum(req.query.radius);
            const sessionToken = req.query.session_token ? String(req.query.session_token) : undefined;

            const data = await googlePlacesGeocodeService.placeAutocomplete(input, {
                sessionToken,
                lat: lat ?? undefined,
                lng: lng ?? undefined,
                radiusM: radiusM ?? undefined
            });

            if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
                return res.status(502).json({
                    success: false,
                    error: data.error_message || `Google Places: ${data.status}`
                });
            }

            const predictions = (data.predictions || [])
                .map(googlePlacesGeocodeService.mapPrediction)
                .filter(Boolean);

            return res.json({
                success: true,
                data: {
                    status: data.status,
                    predictions
                }
            });
        } catch (err) {
            console.error('[geocode/search]', err.message);
            return res.status(500).json({
                success: false,
                error: err.message || 'Lỗi gợi ý địa chỉ'
            });
        }
    },

    /**
     * GET /api/v1/geocode/place?place_id=...
     * Chi tiết địa điểm → lat/lng chính xác (sau khi user chọn một gợi ý).
     */
    place: async (req, res) => {
        try {
            const placeId = String(req.query.place_id || '').trim();
            if (!placeId) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu place_id'
                });
            }

            const sessionToken = req.query.session_token ? String(req.query.session_token) : undefined;
            const data = await googlePlacesGeocodeService.placeDetails(placeId, { sessionToken });

            if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
                return res.status(502).json({
                    success: false,
                    error: data.error_message || `Google Places: ${data.status}`
                });
            }

            if (data.status !== 'OK' || !data.result) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy địa điểm hoặc place_id không hợp lệ'
                });
            }

            const r = data.result;
            const loc = r.geometry?.location;
            if (loc == null || loc.lat == null || loc.lng == null) {
                return res.status(502).json({
                    success: false,
                    error: 'Google không trả tọa độ cho địa điểm này'
                });
            }

            return res.json({
                success: true,
                data: {
                    place_id: r.place_id,
                    formatted_address: r.formatted_address,
                    name: r.name,
                    location: { lat: loc.lat, lng: loc.lng },
                    types: r.types || []
                }
            });
        } catch (err) {
            console.error('[geocode/place]', err.message);
            return res.status(500).json({
                success: false,
                error: err.message || 'Lỗi lấy chi tiết địa điểm'
            });
        }
    },

    /**
     * GET /api/v1/geocode/forward?address=...
     * Chuỗi địa chỉ đầy đủ → lat/lng (Geocoding; kém “gợi ý theo gõ” hơn Places, dùng khi cần).
     */
    forward: async (req, res) => {
        try {
            const address = String(req.query.address || '').trim();
            if (address.length < 3) {
                return res.status(400).json({
                    success: false,
                    error: 'Tham số address phải có ít nhất 3 ký tự'
                });
            }

            const data = await googlePlacesGeocodeService.geocodeForward(address);

            if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
                return res.status(502).json({
                    success: false,
                    error: data.error_message || `Google Geocoding: ${data.status}`
                });
            }

            if (data.status !== 'OK' || !data.results?.length) {
                return res.json({
                    success: true,
                    data: { status: data.status, results: [] }
                });
            }

            const simplified = data.results.slice(0, 5).map((row) => ({
                formatted_address: row.formatted_address,
                place_id: row.place_id || null,
                location: row.geometry?.location
                    ? { lat: row.geometry.location.lat, lng: row.geometry.location.lng }
                    : null,
                types: row.types || []
            }));

            return res.json({
                success: true,
                data: {
                    status: data.status,
                    results: simplified
                }
            });
        } catch (err) {
            console.error('[geocode/forward]', err.message);
            return res.status(500).json({
                success: false,
                error: err.message || 'Lỗi geocode địa chỉ'
            });
        }
    }
};

module.exports = geocodeController;
