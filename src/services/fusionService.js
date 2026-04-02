/**
 * Fusion đơn giản: trọng số cảm biến giảm theo khoảng cách; trọng số crowd giảm khi lệch mạnh so với cảm biến gần nhất.
 * Có thể tinh chỉnh qua biến môi trường FUSION_*.
 */

function readParams() {
    const num = (v, d) => {
        const x = parseFloat(v);
        return Number.isFinite(x) ? x : d;
    };
    return {
        rMaxM: num(process.env.FUSION_R_MAX_M, 2500),
        decayDistM: num(process.env.FUSION_DECAY_DIST_M, 600),
        disagreeScaleCm: num(process.env.FUSION_DISAGREE_SCALE_CM, 18)
    };
}

/**
 * @param {object} row — từ fusionRepository.getCrowdReportsWithNearestSensor
 * @returns {{ fused_cm, w_sensor, w_crowd, coverage }}
 */
function fuseCrowdRow(row, p = readParams()) {
    const crowdCm = Number(row.crowd_cm);
    const rel = Math.max(0, Math.min(1, Number(row.reliability_score) / 100));
    const sensorCm =
        row.nearest_sensor_cm != null && row.nearest_sensor_cm !== ''
            ? Number(row.nearest_sensor_cm)
            : null;
    const distM =
        row.nearest_sensor_dist_m != null ? Number(row.nearest_sensor_dist_m) : null;

    const hasNearbySensor =
        sensorCm != null &&
        Number.isFinite(sensorCm) &&
        distM != null &&
        Number.isFinite(distM) &&
        distM <= p.rMaxM;

    if (!hasNearbySensor) {
        const coverage =
            sensorCm == null || !Number.isFinite(sensorCm) || row.nearest_sensor_id == null
                ? 'crowd_only_no_sensor'
                : 'crowd_only_far';
        return {
            fused_cm: crowdCm,
            w_sensor: 0,
            w_crowd: rel,
            coverage
        };
    }

    const wSensor = Math.exp(-distM / p.decayDistM);
    const diff = Math.abs(crowdCm - sensorCm);
    const crowdAgreement = Math.exp(-diff / p.disagreeScaleCm);
    const wCrowd = rel * crowdAgreement;
    const sum = wSensor + wCrowd;
    const fused_cm =
        sum > 0 ? (wSensor * sensorCm + wCrowd * crowdCm) / sum : crowdCm;

    return {
        fused_cm: Math.round(fused_cm * 100) / 100,
        w_sensor: Math.round(wSensor * 1000) / 1000,
        w_crowd: Math.round(wCrowd * 1000) / 1000,
        coverage: 'blended'
    };
}

function formatSensorRow(row) {
    const cm =
        row.water_level_cm != null && row.water_level_cm !== ''
            ? Number(row.water_level_cm)
            : null;
    return {
        type: 'sensor',
        sensor_id: row.sensor_id,
        location_name: row.location_name,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        water_level_sensor_only_cm: cm,
        water_level_fused_cm: cm,
        log_status: row.log_status || null,
        log_created_at: row.log_created_at || null
    };
}

function formatCrowdRow(row) {
    const { fused_cm, w_sensor, w_crowd, coverage } = fuseCrowdRow(row);
    const crowdCm = Number(row.crowd_cm);
    const nearest =
        row.nearest_sensor_id != null &&
        row.nearest_sensor_cm != null &&
        row.nearest_sensor_dist_m != null
            ? {
                  sensor_id: row.nearest_sensor_id,
                  water_level_cm: Number(row.nearest_sensor_cm),
                  distance_m: Math.round(Number(row.nearest_sensor_dist_m) * 10) / 10
              }
            : null;

    return {
        type: 'crowd',
        report_id: row.id,
        flood_level: row.flood_level,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        crowd_only_cm: crowdCm,
        fused_cm,
        nearest_sensor: nearest,
        weights: { sensor: w_sensor, crowd: w_crowd },
        coverage,
        reliability_score: Number(row.reliability_score),
        created_at: row.created_at
    };
}

module.exports = {
    readParams,
    fuseCrowdRow,
    formatSensorRow,
    formatCrowdRow
};
