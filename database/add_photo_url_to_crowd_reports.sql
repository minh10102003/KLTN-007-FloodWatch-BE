-- Thêm cột photo_url vào crowd_reports (ảnh báo cáo ngập người dân gửi)
-- Chạy nếu bảng crowd_reports chưa có cột photo_url (vd: mới dùng schema.sql cơ bản)
-- Chạy: npm run migrate:photo-url  hoặc  psql -f database/add_photo_url_to_crowd_reports.sql

ALTER TABLE crowd_reports
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN crowd_reports.photo_url IS 'URL ảnh hiện trường ngập (lưu từ upload, vd: /uploads/xxx.jpg)';
