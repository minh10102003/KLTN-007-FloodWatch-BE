const floodRepository = require('./floodRepository');
const { mucDoNguyHiemFromCm } = require('../utils/floodDangerLevel');

/**
 * Chuẩn hóa bản ghi sensor cho Gemini / API flood-status.
 */
function mapRowToChatSensor(row) {
    const isOffline = row.sensor_status === 'offline';

    if (isOffline) {
        return {
            sensor_id: row.sensor_id,
            khu_vuc: row.location_name,
            trang_thai: 'offline',
            du_lieu_kha_dung: false,
            muc_nuoc_cm: null,
            muc_do_nguy_hiem: null,
            lan_cap_nhat_cuoi: row.last_data_time || row.created_at || null,
            toa_do: {
                lat: row.lat != null ? parseFloat(row.lat) : null,
                lng: row.lng != null ? parseFloat(row.lng) : null
            }
        };
    }

    const mucNuoc = Number(row.water_level) || 0;
    return {
        sensor_id: row.sensor_id,
        khu_vuc: row.location_name,
        trang_thai: row.log_status || row.sensor_status || 'normal',
        du_lieu_kha_dung: true,
        muc_nuoc_cm: mucNuoc,
        muc_do_nguy_hiem: mucDoNguyHiemFromCm(mucNuoc),
        thoi_gian: row.created_at || row.last_data_time || null,
        toa_do: {
            lat: row.lat != null ? parseFloat(row.lat) : null,
            lng: row.lng != null ? parseFloat(row.lng) : null
        },
        nhiet_do: row.temperature != null ? parseFloat(row.temperature) : null,
        do_am: row.humidity != null ? parseFloat(row.humidity) : null
    };
}

/**
 * Snapshot sensor mới nhất (Postgres: sensors + flood_logs).
 * @param {string|null} area - Lọc theo tên vị trí (ILIKE)
 * @param {number} limit - Tối đa bản ghi (sắp theo mực nước giảm dần)
 */
async function getChatSensorSnapshot(area = null, limit = 50) {
    const rows = await floodRepository.getRealTimeFloodData();
    let mapped = rows.map(mapRowToChatSensor);

    const areaTrim = area != null ? String(area).trim() : '';
    if (areaTrim) {
        const needle = areaTrim.toLowerCase();
        mapped = mapped.filter((r) => String(r.khu_vuc || '').toLowerCase().includes(needle));
    }

    mapped.sort((a, b) => {
        if (a.du_lieu_kha_dung !== b.du_lieu_kha_dung) {
            return a.du_lieu_kha_dung ? -1 : 1;
        }
        return (b.muc_nuoc_cm || 0) - (a.muc_nuoc_cm || 0);
    });

    const max = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    return mapped.slice(0, max);
}

module.exports = {
    getChatSensorSnapshot,
    mapRowToChatSensor
};
