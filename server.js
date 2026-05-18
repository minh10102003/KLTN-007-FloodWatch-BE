// server.js
require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const mqttService = require('./src/services/mqttService');
const openMeteoService = require('./src/services/openMeteoService');
const { startScheduledRetention } = require('./src/services/dataRetentionService');

const { attachSocketIo } = require('./src/config/socketIo');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

attachSocketIo(server);

// Khởi tạo kết nối MQTT để hứng dữ liệu từ Cloud/Mạch thực tế
mqttService.init();
startScheduledRetention();

server.listen(PORT, () => {
    console.log(`
    ===========================================
    🚀 HTTP + Socket.IO on port: ${PORT}
    📡 MQTT WORKER IS LISTENING...
    ===========================================
    `);
    setTimeout(() => {
        openMeteoService.warmCache().catch((err) => {
            console.warn('[weather] warmCache:', err.message);
        });
    }, 3000);
});

















