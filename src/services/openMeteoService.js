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

let cacheEntry = null;
let cacheTtlMs = Math.max(60_000, (parseInt(process.env.WEATHER_CACHE_SECONDS, 10) || 600) * 1000);

function getCacheTtlMs() {
    return Math.max(60_000, (parseInt(process.env.WEATHER_CACHE_SECONDS, 10) || 600) * 1000);
}

function httpsGetJson(urlString) {
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
                        reject(new Error(`Open-Meteo trả HTTP ${res.statusCode}`));
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

/**
 * @param {{ latitude: number, longitude: number, forecastDays?: number }} opts
 */
async function fetchForecast(opts) {
    const { latitude, longitude } = opts;
    const forecastDays = Math.min(7, Math.max(1, parseInt(opts.forecastDays, 10) || 3));

    const u = new URL('https://api.open-meteo.com/v1/forecast');
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

    const cacheKey = `${latitude.toFixed(5)}_${longitude.toFixed(5)}_${forecastDays}`;
    cacheTtlMs = getCacheTtlMs();
    const now = Date.now();
    if (cacheEntry && cacheEntry.key === cacheKey && now - cacheEntry.ts < cacheTtlMs) {
        return { ...cacheEntry.data, cached: true };
    }

    const raw = await httpsGetJson(u.toString());

    const payload = {
        cached: false,
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

    cacheEntry = { key: cacheKey, ts: now, data: payload };
    return payload;
}

module.exports = {
    DEFAULT_HCM_LAT,
    DEFAULT_HCM_LON,
    HCM_CENTER_LAT_DMS,
    HCM_CENTER_LON_DMS,
    HCM_BOUNDS,
    readDefaultCoords,
    isInsideHcmBounds,
    fetchForecast
};
