const { Server } = require('socket.io');
const { getSocketCorsOriginList } = require('./corsAllowedOrigins');
const { initAdminSocket } = require('../socket/adminSocket');
const { initMapSocket } = require('../socket/mapSocket');

function attachSocketIo(httpServer) {
    const io = new Server(httpServer, {
        path: '/socket.io',
        cors: {
            origin: getSocketCorsOriginList(),
            credentials: true
        },
        transports: ['polling', 'websocket']
    });
    initAdminSocket(io);
    initMapSocket(io);
    return io;
}

module.exports = { attachSocketIo };
