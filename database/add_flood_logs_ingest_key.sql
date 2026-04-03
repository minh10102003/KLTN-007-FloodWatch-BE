-- Idempotent ingest: trùng (sensor_id, ingest_key) → bỏ qua (B2).
ALTER TABLE flood_logs ADD COLUMN IF NOT EXISTS ingest_key VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_flood_logs_sensor_ingest ON flood_logs (sensor_id, ingest_key);

COMMENT ON COLUMN flood_logs.ingest_key IS 'Khóa chống trùng MQTT (msg_id hoặc hash thời gian+gía trị); null = bản ghi cũ trước migration';
