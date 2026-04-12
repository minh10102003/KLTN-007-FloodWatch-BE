-- Telegram chat riêng từng user (Nhóm C1): liên kết qua deep link + webhook.
-- Chạy: npm run migrate:telegram-per-user

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;

COMMENT ON COLUMN users.telegram_chat_id IS 'Telegram chat_id (private) sau khi user /start bot với token liên kết; dùng sendMessage';
COMMENT ON COLUMN users.telegram_username IS 'username Telegram (@...) nếu có';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_telegram_chat_id
    ON users (telegram_chat_id)
    WHERE telegram_chat_id IS NOT NULL AND telegram_chat_id <> '';

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    token VARCHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user ON telegram_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_expires ON telegram_link_tokens(expires_at);

COMMENT ON TABLE telegram_link_tokens IS 'Token one-shot cho deep link t.me/<bot>?start=<token>, TTL ngắn';
