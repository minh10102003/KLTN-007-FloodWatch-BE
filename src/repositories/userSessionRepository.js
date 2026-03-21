const BaseRepository = require('./baseRepository');

class UserSessionRepository extends BaseRepository {
    async createSession(userId, refreshTokenHash, expiresAt) {
        const query = `
            INSERT INTO user_sessions (user_id, refresh_token_hash, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, expires_at, created_at
        `;
        return await this.queryOne(query, [userId, refreshTokenHash, expiresAt]);
    }

    async findById(sessionId) {
        const query = `
            SELECT id, user_id, refresh_token_hash, expires_at, created_at, revoked_at
            FROM user_sessions
            WHERE id = $1
        `;
        return await this.queryOne(query, [sessionId]);
    }

    /**
     * Phiên còn hiệu lực: chưa thu hồi, chưa hết hạn refresh.
     */
    async isSessionActive(sessionId, userId) {
        const query = `
            SELECT 1
            FROM user_sessions
            WHERE id = $1 AND user_id = $2
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
        `;
        const row = await this.queryOne(query, [sessionId, userId]);
        return Boolean(row);
    }

    async revokeSession(sessionId) {
        await this.query(
            `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL`,
            [sessionId]
        );
    }

    async revokeAllForUser(userId) {
        await this.query(
            `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND revoked_at IS NULL`,
            [userId]
        );
    }

    async updateRefreshToken(sessionId, refreshTokenHash, expiresAt) {
        const query = `
            UPDATE user_sessions
            SET refresh_token_hash = $1, expires_at = $2
            WHERE id = $3 AND revoked_at IS NULL
            RETURNING id, user_id, expires_at
        `;
        return await this.queryOne(query, [refreshTokenHash, expiresAt, sessionId]);
    }
}

module.exports = new UserSessionRepository();
