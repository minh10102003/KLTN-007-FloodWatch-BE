const { randomUUID } = require('crypto');
const { verifyAccessToken } = require('../services/tokenService');
const userSessionRepository = require('../repositories/userSessionRepository');

let adminNamespace = null;

function hasRole(user, roleName) {
    if (!user) return false;
    if (Array.isArray(user.roles)) return user.roles.includes(roleName);
    return user.role === roleName;
}

function isStaffUser(user) {
    return hasRole(user, 'admin') || hasRole(user, 'moderator');
}

async function authenticateSocketToken(token) {
    if (!token) {
        throw new Error('Unauthorized');
    }
    let decoded;
    try {
        decoded = verifyAccessToken(token);
    } catch {
        throw new Error('Unauthorized');
    }
    if (decoded.typ !== 'access' || !decoded.sid) {
        throw new Error('Unauthorized');
    }
    const active = await userSessionRepository.isSessionActive(decoded.sid, decoded.id);
    if (!active) {
        throw new Error('Unauthorized');
    }
    return decoded;
}

function initAdminSocket(io) {
    adminNamespace = io.of('/admin');

    adminNamespace.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            const user = await authenticateSocketToken(token);
            if (!isStaffUser(user)) {
                return next(new Error('Forbidden'));
            }
            socket.user = user;
            if (hasRole(user, 'moderator')) socket.join('moderators');
            if (hasRole(user, 'admin')) socket.join('admins');
            socket.join('staff');
            next();
        } catch (err) {
            next(err.message === 'Forbidden' ? new Error('Forbidden') : new Error('Unauthorized'));
        }
    });

    adminNamespace.on('connection', (socket) => {
        console.log('[socket] admin connected', socket.user?.id);
        socket.on('disconnect', (reason) => {
            console.log('[socket] admin disconnected', socket.user?.id, reason);
        });
    });
}

function emitAdminNotification(payload) {
    if (!adminNamespace) return;
    const message = {
        id: payload.id || randomUUID(),
        type: payload.type,
        reportId: payload.reportId ?? payload.report_id ?? undefined,
        sensorId: payload.sensorId ?? payload.sensor_id ?? undefined,
        createdAt: payload.createdAt || new Date().toISOString()
    };
    if (message.reportId == null) delete message.reportId;
    if (message.sensorId == null) delete message.sensorId;
    adminNamespace.to('staff').emit('admin:notification', message);
}

module.exports = {
    initAdminSocket,
    emitAdminNotification,
    authenticateSocketToken,
    isStaffUser
};
