const floodRepository = require('./floodRepository');
const crowdReportRepository = require('./crowdReportRepository');
const { mucDoNguyHiemFromCm } = require('../utils/floodDangerLevel');
const { floodLevelToCm, getFloodLevelLabel } = require('../utils/floodLevelMapper');

const DEFAULT_CROWD_HOURS = 24;
const DEFAULT_CROWD_LIMIT = 30;

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

/**
 * Chuẩn hóa báo cáo người dân đã duyệt cho Gemini (đường/khu ngập).
 */
function mapRowToChatCrowdReport(row) {
    const content = row.content != null ? String(row.content).trim().slice(0, 240) : null;
    const lat = row.lat != null ? parseFloat(row.lat) : null;
    const lng = row.lng != null ? parseFloat(row.lng) : null;

    return {
        id: row.id,
        muc_ngap: row.flood_level,
        muc_ngap_label: getFloodLevelLabel(row.flood_level),
        muc_nuoc_uoc_tinh_cm: floodLevelToCm(row.flood_level),
        mo_ta: content || null,
        xac_minh_cheo: row.validation_status === 'cross_verified',
        xac_minh_cam_bien: row.verified_by_sensor === true,
        tu_dong_duyet: row.auto_approved === true,
        diem_tin_cay: row.reliability_score != null ? Number(row.reliability_score) : null,
        toa_do: { lat, lng },
        thoi_gian: row.created_at || null
    };
}

/**
 * Báo cáo người dân đã duyệt (24h gần nhất) — dùng gợi ý đoạn đường ngập.
 * @param {number} hours
 * @param {string|null} area - Lọc theo nội dung mô tả (contains)
 * @param {number} limit
 */
async function getChatCrowdReportSnapshot(
    hours = DEFAULT_CROWD_HOURS,
    area = null,
    limit = DEFAULT_CROWD_LIMIT
) {
    const windowHours = Math.min(168, Math.max(1, parseInt(hours, 10) || DEFAULT_CROWD_HOURS));
    const rows = await crowdReportRepository.getRecentReports(windowHours, 'approved');
    let mapped = rows.map(mapRowToChatCrowdReport);

    const areaTrim = area != null ? String(area).trim() : '';
    if (areaTrim) {
        const needle = areaTrim.toLowerCase();
        mapped = mapped.filter(
            (r) =>
                String(r.mo_ta || '').toLowerCase().includes(needle) ||
                String(r.muc_ngap_label || '').toLowerCase().includes(needle)
        );
    }

    mapped.sort((a, b) => {
        const cmDiff = (b.muc_nuoc_uoc_tinh_cm || 0) - (a.muc_nuoc_uoc_tinh_cm || 0);
        if (cmDiff !== 0) return cmDiff;
        if (a.xac_minh_cheo !== b.xac_minh_cheo) return a.xac_minh_cheo ? -1 : 1;
        return new Date(b.thoi_gian || 0) - new Date(a.thoi_gian || 0);
    });

    const max = Math.min(50, Math.max(1, parseInt(limit, 10) || DEFAULT_CROWD_LIMIT));
    return mapped.slice(0, max);
}

module.exports = {
    getChatSensorSnapshot,
    getChatCrowdReportSnapshot,
    mapRowToChatSensor,
    mapRowToChatCrowdReport
};
