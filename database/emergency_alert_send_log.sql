-- Log gửi cảnh báo khẩn (Nhóm C1): dedupe theo sensor + user + loại cảnh báo trong cửa sổ phút.
-- Chạy qua: npm run migrate:emergency-alert-send-log

CREATE TABLE IF NOT EXISTS emergency_alert_send_log (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(64) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_kind VARCHAR(32) NOT NULL,
    channels_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emergency_alert_send_lookup
    ON emergency_alert_send_log (sensor_id, user_id, alert_kind, created_at DESC);

COMMENT ON TABLE emergency_alert_send_log IS 'Ghi nhận lần gửi cảnh báo khẩn thành công để chống spam theo cửa sổ (cooldown).';
