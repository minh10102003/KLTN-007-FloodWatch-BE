/**
 * Kalman 1-D cho chuỗi đo mực nước / khoảng cách (cùng mô hình đã dùng trong MQTT).
 *
 * Tuỳ chọn **innovation gate** (cm): nếu |z - x̂| vượt ngưỡng thì coi là nhiễu đột biến,
 * không đưa giá trị đo thô vào bước cập nhật (giữ z = x̂ dự đoán) — phù hợp kiểm thử
 * mảng kiểu [10, 100, 11, 12] với spike 100.
 */

class KalmanFilter {
    /**
     * @param {number} [processNoise=0.01]
     * @param {number} [measurementNoise=0.25]
     * @param {number|null} [innovationGateCm] — null = tắt gate (hành vi cũ MQTT)
     */
    constructor(processNoise = 0.01, measurementNoise = 0.25, innovationGateCm = null) {
        this.processNoise = processNoise;
        this.measurementNoise = measurementNoise;
        this.innovationGateCm =
            innovationGateCm == null || !Number.isFinite(innovationGateCm)
                ? null
                : Math.max(0, innovationGateCm);
        this.estimatedValue = null;
        this.errorCovariance = 1;
    }

    /**
     * @param {number} measurement
     * @returns {number}
     */
    filter(measurement) {
        if (this.estimatedValue === null) {
            this.estimatedValue = measurement;
            return measurement;
        }

        let z = measurement;
        if (this.innovationGateCm != null) {
            const innov = z - this.estimatedValue;
            if (Math.abs(innov) > this.innovationGateCm) {
                z = this.estimatedValue;
            }
        }

        const predictedErrorCovariance = this.errorCovariance + this.processNoise;
        const kalmanGain =
            predictedErrorCovariance / (predictedErrorCovariance + this.measurementNoise);
        this.estimatedValue = this.estimatedValue + kalmanGain * (z - this.estimatedValue);
        this.errorCovariance = (1 - kalmanGain) * predictedErrorCovariance;

        return this.estimatedValue;
    }

    reset() {
        this.estimatedValue = null;
        this.errorCovariance = 1;
    }
}

/**
 * Lọc tuần tự một mảng đo (mực nước hoặc khoảng cách đã quy về cùng đơn vị với Kalman).
 *
 * @param {number[]} measurements
 * @param {{ processNoise?: number, measurementNoise?: number, innovationGateCm?: number|null }} [options]
 * @returns {number[]}
 */
function filterWaterLevelSeries(measurements, options = {}) {
    const processNoise = options.processNoise ?? 0.01;
    const measurementNoise = options.measurementNoise ?? 0.25;
    const innovationGateCm =
        options.innovationGateCm === undefined ? null : options.innovationGateCm;

    const k = new KalmanFilter(processNoise, measurementNoise, innovationGateCm);
    return measurements.map((raw) => {
        const z = Number(raw);
        if (!Number.isFinite(z)) {
            return NaN;
        }
        return k.filter(z);
    });
}

module.exports = {
    KalmanFilter,
    filterWaterLevelSeries,
};
