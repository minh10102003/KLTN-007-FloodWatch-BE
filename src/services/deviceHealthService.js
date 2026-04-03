/**
 * Phân loại health cho dashboard (B1): online / degraded / offline / inactive.
 * Ngưỡng phút có thể chỉnh qua biến môi trường.
 */

function readThresholds() {
    const onlineMax = Math.max(0.5, parseFloat(process.env.HEALTH_ONLINE_MAX_MINUTES) || 2);
    const degradedMax = Math.max(onlineMax, parseFloat(process.env.HEALTH_DEGRADED_MAX_MINUTES) || 5);
    return { onlineMax, degradedMax };
}

/**
 * @param {object} row — một dòng từ getDevicesHealthOverview
 */
function classifyDeviceHealth(row) {
    if (!row.is_active) {
        return { health: 'inactive', reason: 'Sensor is_active = false' };
    }

    const { onlineMax, degradedMax } = readThresholds();

    if (row.row_status === 'offline' && !row.last_data_time) {
        return { health: 'offline', reason: 'Chưa có last_data_time' };
    }

    if (!row.last_data_time) {
        return { health: 'offline', reason: 'Chưa nhận dữ liệu' };
    }

    const last = new Date(row.last_data_time).getTime();
    if (Number.isNaN(last)) {
        return { health: 'unknown', reason: 'last_data_time không hợp lệ' };
    }
    const minutes = (Date.now() - last) / 60000;

    if (minutes <= onlineMax) {
        return { health: 'online', reason: null, minutes_since_data: Math.round(minutes * 10) / 10 };
    }
    if (minutes <= degradedMax) {
        return { health: 'degraded', reason: 'Dữ liệu trễ', minutes_since_data: Math.round(minutes * 10) / 10 };
    }
    return {
        health: 'offline',
        reason: `Không có dữ liệu > ${degradedMax} phút`,
        minutes_since_data: Math.round(minutes * 10) / 10
    };
}

function formatOverviewRow(row) {
    const { health, reason, minutes_since_data } = classifyDeviceHealth(row);
    return {
        sensor_id: row.sensor_id,
        location_name: row.location_name,
        is_active: row.is_active,
        health,
        health_reason: reason,
        minutes_since_data:
            minutes_since_data ??
            (row.last_data_time
                ? Math.round(((Date.now() - new Date(row.last_data_time).getTime()) / 60000) * 10) / 10
                : null),
        row_status: row.row_status,
        last_data_time: row.last_data_time,
        last_flood_log: row.last_flood_log_at
            ? {
                  water_level_cm: row.last_water_level_cm != null ? parseFloat(row.last_water_level_cm) : null,
                  status: row.last_log_status,
                  created_at: row.last_flood_log_at
              }
            : null,
        power: {
            battery_level:
                row.sensor_battery_level != null ? row.sensor_battery_level : row.energy_battery_level,
            power_source: row.power_source,
            last_energy_at: row.last_energy_at,
            energy_voltage: row.energy_voltage != null ? parseFloat(row.energy_voltage) : null
        },
        firmware_version: row.firmware_version,
        hardware_type: row.hardware_type,
        model: row.model,
        telemetry_note:
            'RSSI / packet loss: firmware có thể gửi msg_id (dedupe) hoặc sau này mở rộng cột/JSON trên sensors.'
    };
}

module.exports = {
    classifyDeviceHealth,
    formatOverviewRow,
    readThresholds
};
