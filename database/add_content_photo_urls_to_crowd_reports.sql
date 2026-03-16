-- Thêm cột content (mô tả mức độ ngập) và photo_urls (nhiều ảnh) vào crowd_reports
-- Chạy: npm run migrate:content-photo-urls  hoặc  psql -U user -d dbname -f database/add_content_photo_urls_to_crowd_reports.sql

-- Cột content: nội dung mô tả mức độ ngập (tùy chọn, tối đa 500 ký tự)
ALTER TABLE crowd_reports
ADD COLUMN IF NOT EXISTS content VARCHAR(500);
COMMENT ON COLUMN crowd_reports.content IS 'Nội dung mô tả mức độ ngập (tùy chọn, tối đa 500 ký tự)';

-- Cột photo_urls: mảng URL ảnh (JSONB), tối đa 5 ảnh
ALTER TABLE crowd_reports
ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN crowd_reports.photo_urls IS 'Mảng URL ảnh (JSON array), tối đa 5 ảnh; photo_url = ảnh đầu để tương thích';
