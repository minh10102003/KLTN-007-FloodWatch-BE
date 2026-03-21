const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function getAccessSecret() {
    return process.env.JWT_SECRET || 'your-secret-key';
}

function getAccessExpiresIn() {
    return process.env.JWT_ACCESS_EXPIRES_IN || '15m';
}

function getRefreshExpiresMs() {
    const days = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10);
    if (Number.isNaN(days) || days < 1) return 7 * 24 * 60 * 60 * 1000;
    return days * 24 * 60 * 60 * 1000;
}

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function generateRefreshToken() {
    return crypto.randomBytes(48).toString('base64url');
}

function signAccessToken({ id, username, role, sid }) {
    return jwt.sign(
        { id, username, role, typ: 'access', sid },
        getAccessSecret(),
        { expiresIn: getAccessExpiresIn() }
    );
}

function verifyAccessToken(token) {
    return jwt.verify(token, getAccessSecret());
}

/**
 * So sánh hash refresh an toàn thời gian (cùng độ dài SHA-256 hex).
 */
function refreshHashesEqual(storedHex, computedHex) {
    try {
        const a = Buffer.from(storedHex, 'hex');
        const b = Buffer.from(computedHex, 'hex');
        if (a.length !== b.length || a.length !== 32) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

module.exports = {
    getRefreshExpiresMs,
    hashRefreshToken,
    generateRefreshToken,
    signAccessToken,
    verifyAccessToken,
    refreshHashesEqual
};
