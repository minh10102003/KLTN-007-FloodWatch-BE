const https = require('https');

/** Trung tâm địa lý TP.HCM (Cổng TT TP.HCM): 10°49′23″N, 106°37′46″E */
const HCM_CENTER_LAT_DMS = { deg: 10, min: 49, sec: 23, hemi: 'N' };
const HCM_CENTER_LON_DMS = { deg: 106, min: 37, sec: 46, hemi: 'E' };

function dmsToDecimal(d, m, s) {
    return d + m / 60 + s / 3600;
}

const DEFAULT_HCM_LAT = dmsToDecimal(
    HCM_CENTER_LAT_DMS.deg,
    HCM_CENTER_LAT_DMS.min,
    HCM_CENTER_LAT_DMS.sec
);
const DEFAULT_HCM_LON = dmsToDecimal(
    HCM_CENTER_LON_DMS.deg,
    HCM_CENTER_LON_DMS.min,
    HCM_CENTER_LON_DMS.sec
);

/** Phạm vi TP.HCM (tham chiếu): ~10°38′–11°10′N, 106°22′–106°56′E */
const HCM_BOUNDS = {
    latMin: dmsToDecimal(10, 38, 0),
    latMax: dmsToDecimal(11, 10, 0),
    lonMin: dmsToDecimal(106, 22, 0),
    lonMax: dmsToDecimal(106, 56, 0)
};

function readDefaultCoords() {
    const lat = parseFloat(process.env.WEATHER_HCM_LAT);
    const lon = parseFloat(process.env.WEATHER_HCM_LON);
    return {
        latitude: Number.isFinite(lat) ? lat : DEFAULT_HCM_LAT,
        longitude: Number.isFinite(lon) ? lon : DEFAULT_HCM_LON
    };
}

function isInsideHcmBounds(lat, lon) {
    return (
        lat >= HCM_BOUNDS.latMin &&
        lat <= HCM_BOUNDS.latMax &&
        lon >= HCM_BOUNDS.lonMin &&
        lon <= HCM_BOUNDS.lonMax
    );
}

/** @type {Map<string, { ts: number, data: object }>} */
const cacheByKey = new Map();
/** @type {Map<string, Promise<object>>} */
const inFlightByCoord = new Map();

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function coordCacheKey(latitude, longitude) {
    return `${latitude.toFixed(5)}_${longitude.toFixed(5)}`;
}

function getUpstreamForecastDays(requestedDays) {
    const envDays = parseInt(process.env.WEATHER_FETCH_DAYS, 10);
    const base = Number.isFinite(envDays) ? Math.min(7, Math.max(1, envDays)) : 3;
    return Math.min(7, Math.max(requestedDays, base));
}

function getCacheTtlMs() {
    return Math.max(60_000, (parseInt(process.env.WEATHER_CACHE_SECONDS, 10) || 7200) * 1000);
}

function getOpenMeteoBaseUrl() {
    const raw = (process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com').replace(/\/$/, '');
    return raw;
}

let upstreamBlockedUntil = 0;

function getCooldownMs() {
    return Math.max(60_000, (parseInt(process.env.WEATHER_COOLDOWN_SECONDS, 10) || 600) * 1000);
}

function isUpstreamBlocked() {
    return Date.now() < upstreamBlockedUntil;
}

function blockUpstream() {
    upstreamBlockedUntil = Date.now() + getCooldownMs();
}

/** Dữ liệu tối thiểu để FE không 502 khi Open-Meteo 429 (TP.HCM mặc định). */
function buildBuiltinFallback(latitude, longitude, forecastDaysRequested) {
    const now = new Date();
    const hourlyTimes = [];
    const hourlyTemp = [];
    const hourlyPop = [];
    for (let i = 0; i < 8; i++) {
        const t = new Date(now.getTime() + i * 3600_000);
        hourlyTimes.push(t.toISOString());
        hourlyTemp.push(28);
        hourlyPop.push(40);
    }
    return {
        cached: false,
        stale: true,
        degraded: true,
        fallback: true,
        forecast_days_requested: forecastDaysRequested,
        forecast_days_fetched: 0,
        source: 'fallback',
        source_url: 'https://open-meteo.com/',
        attribution:
            'Dữ liệu thời tiết tạm thời (Open-Meteo đang giới hạn tần suất). Sẽ tự cập nhật khi có thể.',
        coordinates_used: { latitude, longitude },
        timezone: 'Asia/Ho_Chi_Minh',
        current: {
            time: now.toISOString(),
            temperature_2m: 28,
            relative_humidity_2m: 75,
            weather_code: 2,
            wind_speed_10m: 12,
            is_day: 1
        },
        hourly_units: {
            time: 'iso8601',
            temperature_2m: '°C',
            precipitation_probability: '%'
        },
        hourly: {
            time: hourlyTimes,
            temperature_2m: hourlyTemp,
            precipitation_probability: hourlyPop
        },
        daily_units: null,
        daily: null
    };
}

/** Cho phép trả cache cũ khi Open-Meteo 429/5xx (mặc định 24h). */
function getStaleMaxMs() {
    const sec = parseInt(process.env.WEATHER_STALE_MAX_SECONDS, 10);
    if (Number.isFinite(sec) && sec > 0) return sec * 1000;
    return 86_400_000;
}

function readCacheEntry(key) {
    return cacheByKey.get(key) || null;
}

function writeCacheEntry(key, data) {
    cacheByKey.set(key, { ts: Date.now(), data });
}

function findStalePayload(cacheKey, latitude, longitude) {
    const now = Date.now();
    const staleMaxMs = getStaleMaxMs();
    const exact = readCacheEntry(cacheKey);
    if (exact && now - exact.ts < staleMaxMs) {
        return { entry: exact, fromExactKey: true };
    }
    for (const [key, entry] of cacheByKey) {
        if (key === cacheKey) continue;
        if (now - entry.ts >= staleMaxMs) continue;
        const coords = entry.data?.coordinates_used;
        if (
            coords &&
            Math.abs(coords.latitude - latitude) < 0.0001 &&
            Math.abs(coords.longitude - longitude) < 0.0001
        ) {
            return { entry, fromExactKey: false };
        }
    }
    return null;
}

function wrapCachedPayload(data, { stale = false, fromExactKey = true } = {}) {
    return {
        ...data,
        cached: true,
        stale,
        stale_from_exact_key: fromExactKey
    };
}

function httpsGetJsonOnce(urlString) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            urlString,
            {
                headers: { 'User-Agent': 'FloodWatch-BE/1.0 (KLTN; Open-Meteo consumer)' },
                timeout: 20_000
            },
            (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        const err = new Error(`Open-Meteo trả HTTP ${res.statusCode}`);
                        err.statusCode = res.statusCode;
                        reject(err);
                        return;
                    }
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error('Open-Meteo: JSON không hợp lệ'));
                    }
                });
            }
        );
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Open-Meteo: timeout'));
        });
    });
}

async function httpsGetJsonWithRetry(urlString) {
    const maxAttempts = Math.min(5, Math.max(1, parseInt(process.env.WEATHER_RETRY_ATTEMPTS, 10) || 4));
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await httpsGetJsonOnce(urlString);
        } catch (err) {
            lastErr = err;
            const retryable = err.statusCode === 429 || err.statusCode >= 500;
            if (!retryable || attempt === maxAttempts) break;
            await sleep(Math.min(10_000, 750 * 2 ** (attempt - 1)));
        }
    }
    throw lastErr;
}

function buildOpenMeteoUrl(latitude, longitude, forecastDays) {
    const u = new URL(`${getOpenMeteoBaseUrl()}/v1/forecast`);
    u.searchParams.set('latitude', String(latitude));
    u.searchParams.set('longitude', String(longitude));
    u.searchParams.set('timezone', 'Asia/Ho_Chi_Minh');
    u.searchParams.set(
        'current',
        'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day'
    );
    u.searchParams.set(
        'hourly',
        'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,rain,weather_code,cloud_cover,wind_speed_10m'
    );
    u.searchParams.set('forecast_days', String(forecastDays));
    const apiKey = process.env.OPEN_METEO_API_KEY;
    if (apiKey) {
        u.searchParams.set('apikey', apiKey);
    }
    return u.toString();
}

function rawToPayload(raw, latitude, longitude, forecastDaysFetched, forecastDaysRequested) {
    return {
        cached: false,
        stale: false,
        forecast_days_requested: forecastDaysRequested,
        forecast_days_fetched: forecastDaysFetched,
        source: 'open-meteo',
        source_url: 'https://open-meteo.com/',
        attribution:
            'Dữ liệu thời tiết: Open-Meteo (CC BY 4.0). Sử dụng có trách nhiệm; xem https://open-meteo.com/',
        coordinates_used: { latitude, longitude },
        timezone: raw.timezone || 'Asia/Ho_Chi_Minh',
        current: raw.current || null,
        hourly_units: raw.hourly_units || null,
        hourly: raw.hourly || null,
        daily_units: raw.daily_units || null,
        daily: raw.daily || null
    };
}

/**
 * @param {{ latitude: number, longitude: number, forecastDays?: number }} opts
 */
async function fetchUpstream(latitude, longitude, forecastDaysRequested) {
    const forecastDaysFetched = getUpstreamForecastDays(forecastDaysRequested);
    const cacheKey = coordCacheKey(latitude, longitude);
    const cacheTtlMs = getCacheTtlMs();
    const now = Date.now();
    const fresh = readCacheEntry(cacheKey);
    if (
        fresh &&
        now - fresh.ts < cacheTtlMs &&
        (fresh.data?.forecast_days_fetched || 0) >= forecastDaysRequested
    ) {
        return wrapCachedPayload(
            { ...fresh.data, forecast_days_requested: forecastDaysRequested },
            { stale: false, fromExactKey: true }
        );
    }

    const existing = inFlightByCoord.get(cacheKey);
    if (existing) {
        const shared = await existing;
        return { ...shared, cached: true, forecast_days_requested: forecastDaysRequested };
    }

    const resolveDegraded = (fromExactKey = true) => {
        const staleHit = findStalePayload(cacheKey, latitude, longitude);
        if (staleHit) {
            return wrapCachedPayload(
                {
                    ...staleHit.entry.data,
                    forecast_days_requested: forecastDaysRequested,
                    degraded: true
                },
                { stale: true, fromExactKey: staleHit.fromExactKey }
            );
        }
        const fallback = buildBuiltinFallback(latitude, longitude, forecastDaysRequested);
        writeCacheEntry(cacheKey, fallback);
        return fallback;
    };

    const work = (async () => {
        if (isUpstreamBlocked()) {
            return resolveDegraded();
        }

        let raw;
        try {
            raw = await httpsGetJsonWithRetry(
                buildOpenMeteoUrl(latitude, longitude, forecastDaysFetched)
            );
        } catch (err) {
            if (err.statusCode === 429) {
                blockUpstream();
            }
            return resolveDegraded();
        }

        const payload = rawToPayload(
            raw,
            latitude,
            longitude,
            forecastDaysFetched,
            forecastDaysRequested
        );
        writeCacheEntry(cacheKey, payload);
        upstreamBlockedUntil = 0;
        return payload;
    })();

    inFlightByCoord.set(cacheKey, work);
    try {
        return await work;
    } finally {
        inFlightByCoord.delete(cacheKey);
    }
}

async function fetchForecast(opts) {
    const { latitude, longitude } = opts;
    const forecastDays = Math.min(7, Math.max(1, parseInt(opts.forecastDays, 10) || 3));
    return fetchUpstream(latitude, longitude, forecastDays);
}

/** Gọi khi server start + sau deploy để có cache/fallback sẵn. */
async function warmCache() {
    const { latitude, longitude } = readDefaultCoords();
    const cacheKey = coordCacheKey(latitude, longitude);
    if (readCacheEntry(cacheKey)) return;
    try {
        await fetchUpstream(latitude, longitude, 3);
    } catch {
        writeCacheEntry(cacheKey, buildBuiltinFallback(latitude, longitude, 3));
    }
}

module.exports = {
    DEFAULT_HCM_LAT,
    DEFAULT_HCM_LON,
    HCM_CENTER_LAT_DMS,
    HCM_CENTER_LON_DMS,
    HCM_BOUNDS,
    readDefaultCoords,
    isInsideHcmBounds,
    fetchForecast,
    warmCache
};
