-- Xác minh email sau đăng ký (OTP). User cũ: coi như đã xác minh tại thời điểm created_at.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified_at IS NULL;
