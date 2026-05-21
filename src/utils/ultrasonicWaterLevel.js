/**
 * Tính mực nước (cm) từ khoảng cách siêu âm JSN-SR04T — khớp sơ đồ lắp ống:
 *
 *   installationHeightCm ─── [SENSOR / nắp trên] ───
 *            ↕ measuredDistanceCm (từ sensor xuống mặt phản xạ)
 *   0 cm ─── [nắp dưới / mặt đất] ───
 *
 * Mực nước dâng từ 0 → tối đa (installationHeight − minBlindDistance):
 *   water_level_cm = installationHeight − distance   (vùng đo tin cậy)
 *
 * @see firmware/sensor_node_lora.ino (INSTALLATION_HEIGHT, MIN_DISTANCE)
 */

/** Vùng mù siêu âm (cm) — khoảng cách đo < ngưỡng này → coi ngập tối đa trong thang đo */
const DEFAULT_MIN_BLIND_DISTANCE_CM = 20;

/** Chiều cao lắp mặc định (cm) khi tham chiếu NODE_007 firmware */
const DEFAULT_INSTALLATION_HEIGHT_CM = 75;

/**
 * @typedef {'invalid'|'dry'|'normal'|'blind_zone'} WaterLevelZone
 */

/**
 * @param {number} measuredDistanceCm - Khoảng cách đo được (cm), sau lọc Kalman
 * @param {{ installationHeightCm: number, minBlindDistanceCm?: number }} [options]
 * @returns {{
 *   water_level_cm: number,
 *   water_level_percent: number | null,
 *   zone: WaterLevelZone,
 *   max_measurable_water_cm: number,
 *   measured_distance_cm: number,
 *   installation_height_cm: number
 * }}
 */
function computeWaterLevelFromDistance(measuredDistanceCm, options = {}) {
    const installationHeightCm = Number(options.installationHeightCm);
    const minBlindDistanceCm =
        options.minBlindDistanceCm != null
            ? Number(options.minBlindDistanceCm)
            : DEFAULT_MIN_BLIND_DISTANCE_CM;

    const distance = Number(measuredDistanceCm);

    const maxMeasurableWaterCm = Math.max(
        0,
        installationHeightCm - minBlindDistanceCm
    );

    const base = {
        measured_distance_cm: distance,
        installation_height_cm: installationHeightCm,
        max_measurable_water_cm: maxMeasurableWaterCm
    };

    if (!Number.isFinite(installationHeightCm) || installationHeightCm <= 0) {
        return {
            ...base,
            water_level_cm: 0,
            water_level_percent: null,
            zone: 'invalid'
        };
    }

    if (!Number.isFinite(distance) || distance <= 0) {
        return {
            ...base,
            water_level_cm: 0,
            water_level_percent: null,
            zone: 'invalid'
        };
    }

    // Mặt phản xạ xa hơn đỉnh ống → coi như không ngập (mực nước 0)
    if (distance >= installationHeightCm) {
        return {
            ...base,
            water_level_cm: 0,
            water_level_percent: 0,
            zone: 'dry'
        };
    }

    // Vùng mù: khoảng cách quá nhỏ → mực nước tối đa trong thang đo tin cậy
    if (distance <= minBlindDistanceCm) {
        const wl = roundCm(maxMeasurableWaterCm);
        return {
            ...base,
            water_level_cm: wl,
            water_level_percent: percentOfMax(wl, maxMeasurableWaterCm),
            zone: 'blind_zone'
        };
    }

    // Vùng tuyến tính: mực nước = H − distance
    const rawWl = installationHeightCm - distance;
    const water_level_cm = roundCm(clamp(rawWl, 0, maxMeasurableWaterCm));

    return {
        ...base,
        water_level_cm,
        water_level_percent: percentOfMax(water_level_cm, maxMeasurableWaterCm),
        zone: 'normal'
    };
}

function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}

function roundCm(v) {
    return Math.round(Number(v) * 100) / 100;
}

function percentOfMax(waterCm, maxCm) {
    if (!Number.isFinite(maxCm) || maxCm <= 0) return null;
    const p = (Number(waterCm) / maxCm) * 100;
    return Math.round(clamp(p, 0, 100));
}

module.exports = {
    DEFAULT_MIN_BLIND_DISTANCE_CM,
    DEFAULT_INSTALLATION_HEIGHT_CM,
    computeWaterLevelFromDistance
};
