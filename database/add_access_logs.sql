-- Bảng ghi lượt truy cập (middleware ghi mỗi request tới /api)
CREATE TABLE IF NOT EXISTS access_logs (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    path VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);

COMMENT ON TABLE access_logs IS 'Lượt truy cập API – middleware ghi mỗi request';
