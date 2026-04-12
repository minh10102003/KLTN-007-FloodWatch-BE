const BaseRepository = require('./baseRepository');

class TelegramLinkRepository extends BaseRepository {
    /**
     * @param {string} token — tối đa 64 ký tự (Telegram /start)
     * @param {number} userId
     * @param {number} ttlMinutes
     */
    async createLinkToken(token, userId, ttlMinutes = 15) {
        const mins = Math.max(5, Math.min(120, parseInt(ttlMinutes, 10) || 15));
        await this.query(
            `
            INSERT INTO telegram_link_tokens (token, user_id, expires_at)
            VALUES ($1, $2, NOW() + ($3::int * INTERVAL '1 minute'))
            `,
            [String(token).slice(0, 64), userId, mins]
        );
        return { token: String(token).slice(0, 64), expires_in_minutes: mins };
    }

    /**
     * Lấy user_id nếu token còn hiệu lực và chưa dùng (không đánh dấu consumed — gọi sau khi gán chat).
     */
    async peekValidToken(token) {
        const row = await this.queryOne(
            `
            SELECT user_id FROM telegram_link_tokens
            WHERE token = $1 AND consumed_at IS NULL AND expires_at > NOW()
            `,
            [String(token).slice(0, 64)]
        );
        return row ? row.user_id : null;
    }

    async markConsumed(token) {
        await this.query(
            `UPDATE telegram_link_tokens SET consumed_at = NOW() WHERE token = $1 AND consumed_at IS NULL`,
            [String(token).slice(0, 64)]
        );
    }

    /** Xóa token pending của user (unlink / tạo link mới). */
    async deletePendingForUser(userId) {
        await this.query(
            `DELETE FROM telegram_link_tokens WHERE user_id = $1 AND consumed_at IS NULL`,
            [userId]
        );
    }
}

module.exports = new TelegramLinkRepository();
