const mqtt = require('mqtt');
const crypto = require('crypto');
const sensorRepository = require('../repositories/sensorRepository');
const floodRepository = require('../repositories/floodRepository');
const alertRepository = require('../repositories/alertRepository');
const emergencySubscriptionRepository = require('../repositories/emergencySubscriptionRepository');

// Kalman Filter để lọc nhiễu
class KalmanFilter {
    constructor(processNoise = 0.01, measurementNoise = 0.25) {
        this.processNoise = processNoise;
        this.measurementNoise = measurementNoise;
        this.estimatedValue = null;
        this.errorCovariance = 1;
    }

    filter(measurement) {
        if (this.estimatedValue === null) {
            // Khởi tạo với giá trị đo đầu tiên
            this.estimatedValue = measurement;
            return measurement;
        }

        // Prediction step
        const predictedErrorCovariance = this.errorCovariance + this.processNoise;

        // Update step
        const kalmanGain = predictedErrorCovariance / (predictedErrorCovariance + this.measurementNoise);
        this.estimatedValue = this.estimatedValue + kalmanGain * (measurement - this.estimatedValue);
        this.errorCovariance = (1 - kalmanGain) * predictedErrorCovariance;

        return this.estimatedValue;
    }

    reset() {
        this.estimatedValue = null;
        this.errorCovariance = 1;
    }
}

// Lưu trữ Kalman filter cho mỗi sensor
const kalmanFilters = {};

// Hàm lọc nhiễu dữ liệu - loại bỏ giá trị đột biến
const filterNoise = (rawDistance) => {
    // Loại bỏ giá trị <= 0 hoặc > 500cm (giá trị không hợp lý)
    if (rawDistance <= 0 || rawDistance > 500) {
        return null;
    }
    return rawDistance;
};

// Hàm lọc nhiễu bằng Kalman Filter
const filterWithKalman = (sensorId, rawDistance) => {
    if (!kalmanFilters[sensorId]) {
        kalmanFilters[sensorId] = new KalmanFilter(0.01, 0.25);
    }
    return kalmanFilters[sensorId].filter(rawDistance);
};

// Hàm kiểm tra checksum (nếu có trong payload)
const validateChecksum = (data, receivedChecksum) => {
    if (!receivedChecksum) {
        // Nếu không có checksum, bỏ qua validation (cho tương thích với dữ liệu cũ)
        return true;
    }

    try {
        // Tạo checksum từ dữ liệu (SHA256)
        const dataString = JSON.stringify(data);
        const calculatedChecksum = crypto
            .createHash('sha256')
            .update(dataString)
            .digest('hex')
            .substring(0, 16); // Lấy 16 ký tự đầu

        return calculatedChecksum === receivedChecksum;
    } catch (err) {
        console.error('❌ [Checksum] Error validating:', err.message);
        return false;
    }
};

// Hàm tính vận tốc nước dâng (cm/phút)
const calculateVelocity = async (sensorId, currentWaterLevel) => {
    try {
        // Lấy dữ liệu gần nhất trong khoảng 4-6 phút trước (để có dữ liệu cách đây ~5 phút)
        const result = await floodRepository.getFloodLogForVelocity(sensorId, 4, 6, 5);

        if (result) {
            const previousWaterLevel = result.water_level;
            const timeDiffMinutes = parseFloat(result.time_diff) + 5; // Khoảng cách thời gian thực tế
            
            // Tính vận tốc: (mực nước hiện tại - mực nước trước) / thời gian (phút)
            const velocity = (currentWaterLevel - previousWaterLevel) / timeDiffMinutes;
            return Math.round(velocity * 100) / 100; // Làm tròn 2 chữ số
        }
        return null; // Không có dữ liệu để so sánh
    } catch (err) {
        console.error('❌ [Velocity] Error calculating velocity:', err.message);
        return null;
    }
};

// Hàm xác định trạng thái dựa trên ngưỡng
const determineStatus = async (sensorId, waterLevel) => {
    try {
        const thresholds = await sensorRepository.getThresholds(sensorId);

        if (thresholds) {
            const { warning_threshold, danger_threshold } = thresholds;
            if (waterLevel >= danger_threshold) return 'danger';
            if (waterLevel >= warning_threshold) return 'warning';
            return 'normal';
        }
        // Nếu không có ngưỡng, dùng mặc định
        if (waterLevel >= 30) return 'danger';
        if (waterLevel >= 10) return 'warning';
        return 'normal';
    } catch (err) {
        console.error('❌ [Status] Error determining status:', err.message);
        return 'normal';
    }
};

// Hàm cập nhật health check cho sensor
const updateSensorHealth = async (sensorId, status) => {
    try {
        await sensorRepository.updateSensorHealth(sensorId, status);
    } catch (err) {
        console.error('❌ [Health] Error updating sensor health:', err.message);
    }
};

// Hàm kiểm tra và cập nhật sensor offline (nếu không có dữ liệu > 5 phút)
const checkSensorHealth = async () => {
    try {
        const result = await sensorRepository.checkSensorHealth();
        
        if (result.length > 0) {
            console.log(`⚠️ [Health Check] ${result.length} sensor(s) marked as offline`);
        }
    } catch (err) {
        console.error('❌ [Health Check] Error:', err.message);
    }
};

const init = () => {
    const client = mqtt.connect({
        host: process.env.MQTT_HOST,
        port: process.env.MQTT_PORT,
        protocol: 'mqtts',
        username: process.env.MQTT_USER,
        password: process.env.MQTT_PASS
    });

    client.on('connect', () => {
        client.subscribe('hcm/flood/data');
        console.log('✅ [MQTT] Connected and Subscribed');
        
        // Chạy health check mỗi 1 phút
        setInterval(checkSensorHealth, 60000);
    });

    client.on('message', async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            const { sensor_id, value, checksum, timestamp } = data;
            
            // 1. Kiểm tra checksum (nếu có)
            if (checksum && !validateChecksum({ sensor_id, value, timestamp }, checksum)) {
                console.log(`⚠️ [Checksum] Invalid checksum from ${sensor_id}`);
                return;
            }
            
            // value từ ESP32 là raw_distance (khoảng cách đo được)
            const rawDistance = parseFloat(value);
            
            // 2. Lọc nhiễu dữ liệu cơ bản
            const basicFiltered = filterNoise(rawDistance);
            if (!basicFiltered) {
                console.log(`⚠️ [Filter] Rejected noise data from ${sensor_id}: ${rawDistance}cm`);
                return;
            }

            // 3. Lọc nhiễu bằng Kalman Filter
            const filteredDistance = filterWithKalman(sensor_id, basicFiltered);

            // 4. Lấy thông tin sensor để tính mực nước
            const installationHeight = await sensorRepository.getInstallationHeight(sensor_id);

            if (!installationHeight) {
                console.log(`⚠️ [Sensor] Sensor ${sensor_id} not found or inactive`);
                return;
            }
            
            // 5. Tính mực nước: Mực nước = Độ cao lắp đặt - Khoảng cách đo được
            const waterLevel = Math.max(0, installationHeight - filteredDistance);
            
            // 6. Tính vận tốc nước dâng
            const velocity = await calculateVelocity(sensor_id, waterLevel);
            
            // 7. Xác định trạng thái
            const status = await determineStatus(sensor_id, waterLevel);
            
            // 8. Lưu vào flood_logs
            await floodRepository.createFloodLog({
                sensor_id,
                raw_distance: filteredDistance,
                water_level: waterLevel,
                velocity,
                status
            });
            
            // 9. Cập nhật health check cho sensor
            await updateSensorHealth(sensor_id, status);
            
            // 10. Tạo alert nếu vượt ngưỡng (trigger sẽ tự động tạo alert, nhưng có thể gửi thông báo khẩn)
            if (status === 'danger' || (status === 'warning' && velocity && velocity > 5)) {
                try {
                    // Lấy thông tin sensor để gửi thông báo
                    const sensor = await sensorRepository.getSensorById(sensor_id);
                    if (sensor) {
                        // Tìm users cần nhận cảnh báo trong bán kính
                        const subscribers = await emergencySubscriptionRepository.findUsersInAlertRadius(
                            parseFloat(sensor.lng),
                            parseFloat(sensor.lat),
                            2000 // 2km
                        );

                        // TODO: Gửi thông báo đến subscribers (email, SMS, push notification)
                        if (subscribers.length > 0) {
                            console.log(`📢 [Alert] Sending emergency alerts to ${subscribers.length} subscribers for ${sensor_id}`);
                        }
                    }
                } catch (err) {
                    console.error('❌ [Alert] Error sending notifications:', err.message);
                }
            }
            
            console.log(`💾 [Data] ${sensor_id}: ${waterLevel.toFixed(2)}cm (${status})${velocity !== null ? `, velocity: ${velocity}cm/min` : ''}`);
        } catch (err) {
            console.error('❌ [MQTT] Error processing data:', err.message);
        }
    });
};

module.exports = { init };

