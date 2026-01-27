const mqtt = require('mqtt');
const pool = require('../config/db');

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
    });

    client.on('message', async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`📩 Nhận tin từ ${data.sensor_id}: ${data.value}cm`);

            // Chỉ lưu sensor_id và water_level (đã loại bỏ status và location)
            const query = 'INSERT INTO flood_logs(sensor_id, water_level) VALUES($1, $2)';
            const values = [data.sensor_id, data.value];

            await pool.query(query, values);
            console.log('💾 [Data] Saved from', data.sensor_id);
        } catch (err) {
            console.error('❌ [MQTT] Error parsing data:', err.message);
        }
    });
};

module.exports = { init };

