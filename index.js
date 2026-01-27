require('dotenv').config();
const mqtt = require('mqtt');
const { Pool } = require('pg');

// 1. Cấu hình kết nối PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

// Kiểm tra kết nối DB ngay khi khởi động
pool.connect((err, client, release) => {
    if (err) return console.error('❌ Lỗi kết nối Database:', err.stack);
    console.log('✅ Đã kết nối thành công tới PostgreSQL!');
    release();
});

// 2. Cấu hình kết nối MQTT Cloud
const client = mqtt.connect({
    host: process.env.MQTT_HOST,
    port: process.env.MQTT_PORT,
    protocol: 'mqtts',
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
});

client.on('connect', () => {
    console.log('✅ Backend đã thông mạng với HiveMQ Cloud!');
    client.subscribe('hcm/flood/data');
});

// 3. Logic xử lý và lưu trữ
client.on('message', async (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        console.log(`📩 Nhận tin từ ${data.sensor_id}: ${data.value}cm`);

        // Giả sử cảm biến S01 ở Quận 1 (Kinh độ: 106.70, Vĩ độ: 10.77)
        // Trong thực tế, bạn sẽ lấy lat/lng từ file cấu hình hoặc gửi từ ESP32
        const lat = 10.776; 
        const lng = 106.701;

        const query = `
            INSERT INTO flood_logs (sensor_id, water_level, status, location)
            VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
        `;
        const values = [data.sensor_id, data.value, data.status, lng, lat];

        await pool.query(query, values);
        console.log('💾 Đã lưu dữ liệu thời gian thực vào Database!');

    } catch (err) {
        console.error('❌ Lỗi khi lưu dữ liệu:', err.message);
    }
});

// 4. Web Server với Express
const express = require('express');
const app = express();
const port = 3000;

// Cấu hình để phục vụ file tĩnh từ thư mục public
app.use(express.static('public'));

// Cho phép Backend đọc dữ liệu JSON từ trình duyệt gửi lên
app.use(express.json());

// API lấy tất cả dữ liệu ngập lụt để hiển thị lên bản đồ
app.get('/api/flood-history', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM flood_logs ORDER BY created_at DESC LIMIT 100');
        res.json({
            success: true,
            data: result.rows
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API lấy các báo cáo từ người dân trong vòng 24 giờ qua
app.get('/api/crowd-reports', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT reporter_name, flood_level, 
            ST_X(location::geometry) as lng, 
            ST_Y(location::geometry) as lat, 
            created_at 
            FROM crowd_reports 
            WHERE created_at > NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API nhận báo cáo ngập lụt từ người dùng
app.post('/api/report-flood', async (req, res) => {
    try {
        const { name, level, lng, lat } = req.body;
        const query = `
            INSERT INTO crowd_reports (reporter_name, flood_level, location)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
        `;
        await pool.query(query, [name, level, lng, lat]);
        res.json({ success: true, message: "Cảm ơn bạn đã báo cáo!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 API Server đang chạy tại http://localhost:${port}/api/flood-history`);
});

