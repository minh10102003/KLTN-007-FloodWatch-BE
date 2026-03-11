-- Bảng nhật ký audit: ghi mọi thao tác xóa dữ liệu, thay đổi cấu hình sensor, đổi role, khóa user
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

COMMENT ON TABLE audit_logs IS 'Nhật ký thao tác Admin: sensor, user role/active, xóa dữ liệu';
