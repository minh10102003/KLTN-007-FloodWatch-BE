// server.js
require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const mqttService = require('./src/services/mqttService');
const openMeteoService = require('./src/services/openMeteoService');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Khởi tạo kết nối MQTT để hứng dữ liệu từ Cloud/Mạch thực tế
mqttService.init();

server.listen(PORT, () => {
    console.log(`
    ===========================================
    🚀 SERVER IS RUNNING ON PORT: ${PORT}
    📡 MQTT WORKER IS LISTENING...
    ===========================================
    `);
    setTimeout(() => {
        openMeteoService.warmCache().catch((err) => {
            console.warn('[weather] warmCache:', err.message);
        });
    }, 3000);
});

















