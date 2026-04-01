const BaseRepository = require('./baseRepository');

class OtpRepository extends BaseRepository {
    async createOtp({ user_id, email, code_hash, expires_at, purpose = 'auth' }) {
        const query = `
            INSERT INTO email_otps (user_id, email, code_hash, expires_at, purpose)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, user_id, email, expires_at, purpose, consumed_at, created_at
        `;
        return await this.queryOne(query, [user_id, email.toLowerCase(), code_hash, expires_at, purpose]);
    }

    async findLatestActiveByEmail(email, purpose = 'auth') {
        const query = `
            SELECT id, user_id, email, code_hash, purpose, expires_at, consumed_at, created_at
            FROM email_otps
            WHERE email = $1
              AND purpose = $2
              AND consumed_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
        `;
        return await this.queryOne(query, [email.toLowerCase(), purpose]);
    }

    async countRecentByEmail(email, purpose = 'auth', minutes = 60) {
        const query = `
            SELECT COUNT(*)::int AS count
            FROM email_otps
            WHERE email = $1
              AND purpose = $2
              AND created_at >= NOW() - ($3::text || ' minutes')::interval
        `;
        const row = await this.queryOne(query, [email.toLowerCase(), purpose, String(minutes)]);
        return row?.count || 0;
    }

    async markConsumed(otpId) {
        const query = `
            UPDATE email_otps
            SET consumed_at = NOW(), updated_at = NOW()
            WHERE id = $1
              AND consumed_at IS NULL
            RETURNING id
        `;
        return await this.queryOne(query, [otpId]);
    }
}

module.exports = new OtpRepository();
