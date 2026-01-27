const mqtt = require('mqtt');
const pool = require('../config/db');

// Hàm lọc nhiễu dữ liệu - loại bỏ giá trị đột biến
const filterNoise = (rawDistance) => {
    // Loại bỏ giá trị <= 0 hoặc > 500cm (giá trị không hợp lý)
    if (rawDistance <= 0 || rawDistance > 500) {
        return null;
    }
    return rawDistance;
};

// Hàm tính vận tốc nước dâng (cm/phút)
const calculateVelocity = async (sensorId, currentWaterLevel) => {
    try {
        // Lấy dữ liệu gần nhất trong khoảng 4-6 phút trước (để có dữ liệu cách đây ~5 phút)
        const result = await pool.query(`
            SELECT water_level, created_at,
                   ABS(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 - 5) as time_diff
            FROM flood_logs 
            WHERE sensor_id = $1 
            AND created_at >= NOW() - INTERVAL '6 minutes'
            AND created_at <= NOW() - INTERVAL '4 minutes'
            ORDER BY ABS(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 - 5)
            LIMIT 1
        `, [sensorId]);

        if (result.rows.length > 0) {
            const previousWaterLevel = result.rows[0].water_level;
            const timeDiffMinutes = parseFloat(result.rows[0].time_diff) + 5; // Khoảng cách thời gian thực tế
            
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
        const result = await pool.query(`
            SELECT warning_threshold, danger_threshold 
            FROM sensor_thresholds 
            WHERE sensor_id = $1
        `, [sensorId]);

        if (result.rows.length > 0) {
            const { warning_threshold, danger_threshold } = result.rows[0];
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
        await pool.query(`
            UPDATE sensors 
            SET last_data_time = NOW(), status = $1 
            WHERE sensor_id = $2
        `, [status, sensorId]);
    } catch (err) {
        console.error('❌ [Health] Error updating sensor health:', err.message);
    }
};

// Hàm kiểm tra và cập nhật sensor offline (nếu không có dữ liệu > 5 phút)
const checkSensorHealth = async () => {
    try {
        const result = await pool.query(`
            UPDATE sensors 
            SET status = 'offline' 
            WHERE is_active = TRUE 
            AND (last_data_time IS NULL OR last_data_time < NOW() - INTERVAL '5 minutes')
            AND status != 'offline'
            RETURNING sensor_id
        `);
        
        if (result.rows.length > 0) {
            console.log(`⚠️ [Health Check] ${result.rows.length} sensor(s) marked as offline`);
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
            const { sensor_id, value } = data;
            
            // value từ ESP32 là raw_distance (khoảng cách đo được)
            const rawDistance = parseFloat(value);
            
            // 1. Lọc nhiễu dữ liệu
            const filteredDistance = filterNoise(rawDistance);
            if (!filteredDistance) {
                console.log(`⚠️ [Filter] Rejected noise data from ${sensor_id}: ${rawDistance}cm`);
                return;
            }

            // 2. Lấy thông tin sensor để tính mực nước
            const sensorResult = await pool.query(`
                SELECT installation_height 
                FROM sensors 
                WHERE sensor_id = $1 AND is_active = TRUE
            `, [sensor_id]);

            if (sensorResult.rows.length === 0) {
                console.log(`⚠️ [Sensor] Sensor ${sensor_id} not found or inactive`);
                return;
            }

            const installationHeight = sensorResult.rows[0].installation_height;
            
            // 3. Tính mực nước: Mực nước = Độ cao lắp đặt - Khoảng cách đo được
            const waterLevel = Math.max(0, installationHeight - filteredDistance);
            
            // 4. Tính vận tốc nước dâng
            const velocity = await calculateVelocity(sensor_id, waterLevel);
            
            // 5. Xác định trạng thái
            const status = await determineStatus(sensor_id, waterLevel);
            
            // 6. Lưu vào flood_logs
            const insertQuery = `
                INSERT INTO flood_logs(sensor_id, raw_distance, water_level, velocity, status) 
                VALUES($1, $2, $3, $4, $5)
            `;
            await pool.query(insertQuery, [sensor_id, filteredDistance, waterLevel, velocity, status]);
            
            // 7. Cập nhật health check cho sensor
            await updateSensorHealth(sensor_id, status);
            
            console.log(`💾 [Data] ${sensor_id}: ${waterLevel.toFixed(2)}cm (${status})${velocity !== null ? `, velocity: ${velocity}cm/min` : ''}`);
        } catch (err) {
            console.error('❌ [MQTT] Error processing data:', err.message);
        }
    });
};

module.exports = { init };

