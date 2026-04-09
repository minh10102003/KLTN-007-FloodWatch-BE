const fusionService = require('./fusionService');

function round2(x) {
    return Math.round(Number(x) * 100) / 100;
}

function buildMetrics(rows) {
    if (!rows.length) {
        return { count: 0, mae_cm: null, rmse_cm: null, bias_cm: null };
    }
    const n = rows.length;
    let absSum = 0;
    let sqSum = 0;
    let biasSum = 0;
    for (const e of rows) {
        absSum += Math.abs(e);
        sqSum += e * e;
        biasSum += e;
    }
    return {
        count: n,
        mae_cm: round2(absSum / n),
        rmse_cm: round2(Math.sqrt(sqSum / n)),
        bias_cm: round2(biasSum / n)
    };
}

const researchService = {
    evaluateFusionAgainstNearestSensor(crowdRows) {
        const valid = crowdRows.filter((r) => Number.isFinite(Number(r.nearest_sensor_cm)));
        const baselineErrors = [];
        const fusedErrors = [];
        for (const r of valid) {
            const sensorCm = Number(r.nearest_sensor_cm);
            const crowdCm = Number(r.crowd_cm);
            const fused = fusionService.fuseCrowdRow(r).fused_cm;
            baselineErrors.push(crowdCm - sensorCm);
            fusedErrors.push(Number(fused) - sensorCm);
        }
        return {
            sample_count: valid.length,
            baseline_crowd_only: buildMetrics(baselineErrors),
            fused_model: buildMetrics(fusedErrors)
        };
    }
};

module.exports = researchService;
