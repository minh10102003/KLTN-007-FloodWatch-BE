-- Bảng OTP gửi qua email cho auth/recovery.
CREATE TABLE IF NOT EXISTS email_otps (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    purpose VARCHAR(32) NOT NULL DEFAULT 'auth',
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email_purpose_created
ON email_otps(email, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_otps_active_lookup
ON email_otps(email, purpose, consumed_at, expires_at);
