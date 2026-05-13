const mqtt = require('mqtt');
const crypto = require('crypto');
const sensorRepository = require('../repositories/sensorRepository');
const floodRepository = require('../repositories/floodRepository');
const alertRepository = require('../repositories/alertRepository');
const emergencySubscriptionRepository = require('../repositories/emergencySubscriptionRepository');
const emergencyAlertSendLogRepository = require('../repositories/emergencyAlertSendLogRepository');
const emergencyNotificationService = require('./emergencyNotificationService');
const { KalmanFilter } = require('./kalmanFilterService');
const { determineStatusFromLevel } = require('./floodStatusService');

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

/** Khóa idempotent: ưu tiên msg_id / seq từ thiết bị; không có thì hash (sensor + giây + raw cm). */
function buildMqttIngestKey(sensorId, data, rawDistanceForDedupe) {
    const explicit = data.msg_id ?? data.message_id ?? data.seq ?? data.dedupe_id;
    if (explicit != null && String(explicit).trim() !== '') {
        return crypto
            .createHash('sha256')
            .update(`${sensorId}:${String(explicit)}`)
            .digest('hex')
            .slice(0, 32);
    }
    let sec;
    if (data.timestamp) {
        const t = Date.parse(data.timestamp);
        sec = Number.isFinite(t) ? Math.floor(t / 1000) : Math.floor(Date.now() / 1000);
    } else {
        sec = Math.floor(Date.now() / 1000);
    }
    const rv = Math.round(Number(rawDistanceForDedupe) * 1000) / 1000;
    return crypto.createHash('sha256').update(`${sensorId}|${sec}|${rv}`).digest('hex').slice(0, 32);
}

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

// Hàm xác định trạng thái dựa trên ngưỡng (delegates sang helper thuần để dùng chung cho unit test)
const determineStatus = async (sensorId, waterLevel) => {
    try {
        const thresholds = await sensorRepository.getThresholds(sensorId);
        return determineStatusFromLevel(waterLevel, thresholds || undefined);
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
function emergencyCooldownMinutes() {
    return Math.min(1440, Math.max(5, parseInt(process.env.EMERGENCY_ALERT_COOLDOWN_MINUTES || '20', 10)));
}

/** Loại cảnh báo cho dedupe: danger vs warning + vận tốc cao */
function buildEmergencyAlertKind(status) {
    if (status === 'danger') return 'danger';
    return 'warning_velocity';
}

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
            const { sensor_id, value, checksum, timestamp, temperature, humidity } = data;
            
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
            
            // 8. Lưu vào flood_logs (idempotent theo ingest_key — trùng MQTT bỏ qua)
            const ingest_key = buildMqttIngestKey(sensor_id, data, basicFiltered);
            const log = await floodRepository.createFloodLog({
                sensor_id,
                raw_distance: filteredDistance,
                water_level: waterLevel,
                velocity,
                status,
                temperature: temperature != null ? parseFloat(temperature) : undefined,
                humidity: humidity != null ? parseFloat(humidity) : undefined,
                ingest_key
            });
            if (!log) {
                console.log(`🔁 [MQTT] Dedupe skip ${sensor_id} (${ingest_key.slice(0, 8)}…)`);
                return;
            }

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

                        if (subscribers.length > 0) {
                            console.log(`📢 [Alert] Sending emergency alerts to ${subscribers.length} subscribers for ${sensor_id}`);
                            const alertKind = buildEmergencyAlertKind(status);
                            const cooldownMin = emergencyCooldownMinutes();
                            const payload = {
                                sensorId: sensor_id,
                                locationName: sensor.location_name,
                                status,
                                waterLevel,
                                velocity,
                                lng: parseFloat(sensor.lng),
                                lat: parseFloat(sensor.lat),
                                triggeredAt: new Date().toISOString(),
                                alert_kind: alertKind
                            };
                            for (const subscriber of subscribers) {
                                const methods = emergencyNotificationService.normalizeMethods(
                                    subscriber.notification_methods
                                );
                                let skipSend = false;
                                try {
                                    skipSend = await emergencyAlertSendLogRepository.wasSentRecently(
                                        sensor_id,
                                        subscriber.user_id,
                                        alertKind,
                                        cooldownMin
                                    );
                                } catch (dedupeErr) {
                                    if (dedupeErr.code === '42P01') {
                                        console.warn(
                                            '⚠️ [Alert] Bảng emergency_alert_send_log chưa có — chạy npm run migrate:emergency-alert-send-log (dedupe tạm tắt).'
                                        );
                                        skipSend = false;
                                    } else {
                                        console.error('❌ [Alert] Dedupe check failed:', dedupeErr.message);
                                        skipSend = false;
                                    }
                                }
                                const dangerTelegramEveryReading =
                                    alertKind === 'danger' && methods.includes('telegram');
                                if (skipSend && !dangerTelegramEveryReading) {
                                    console.log(
                                        `🔁 [Alert] Cooldown skip user=${subscriber.user_id} sensor=${sensor_id} kind=${alertKind} (${cooldownMin}m)`
                                    );
                                    continue;
                                }

                                const telegramOnlyBypass = skipSend && dangerTelegramEveryReading;
                                if (telegramOnlyBypass) {
                                    console.log(
                                        `📲 [Alert] Danger → gửi Telegram (bỏ qua cooldown ${cooldownMin}m) user=${subscriber.user_id} sensor=${sensor_id}`
                                    );
                                }

                                const results = telegramOnlyBypass
                                    ? await emergencyNotificationService.notifySubscriber(subscriber, payload, {
                                          channels: ['telegram'],
                                      })
                                    : await emergencyNotificationService.notifySubscriber(subscriber, payload);
                                const successCount = results.filter((r) => r.ok).length;
                                if (successCount < 1) {
                                    console.warn(
                                        `⚠️ [Alert] Notify failed for user=${subscriber.user_id}: ${results
                                            .map((r) => `${r.channel}:${r.reason || 'unknown'}`)
                                            .join(' | ')}`
                                    );
                                } else if (!telegramOnlyBypass) {
                                    try {
                                        await emergencyAlertSendLogRepository.recordSuccessfulSend(
                                            sensor_id,
                                            subscriber.user_id,
                                            alertKind,
                                            JSON.stringify(results)
                                        );
                                    } catch (logErr) {
                                        if (logErr.code === '42P01') {
                                            /* đã cảnh báo ở trên */
                                        } else {
                                            console.error('❌ [Alert] Ghi log gửi thành công thất bại:', logErr.message);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('❌ [Alert] Error sending notifications:', err.message);
                }
            }
            
            const tempStr = temperature != null ? `, temp: ${parseFloat(temperature).toFixed(1)}°C` : '';
            const humStr = humidity != null ? `, humidity: ${parseFloat(humidity).toFixed(0)}%` : '';
            console.log(`💾 [Data] ${sensor_id}: ${waterLevel.toFixed(2)}cm (${status})${velocity !== null ? `, velocity: ${velocity}cm/min` : ''}${tempStr}${humStr}`);
        } catch (err) {
            console.error('❌ [MQTT] Error processing data:', err.message);
        }
    });
};

module.exports = { init };

