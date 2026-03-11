-- Thêm cột avatar cho users: lưu tên file icon (vd: cat.png), chỉ được chọn từ danh sách icon có sẵn
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar VARCHAR(100);

COMMENT ON COLUMN users.avatar IS 'Tên file ảnh đại diện (profile icon), VD: cat.png. Chỉ được chọn từ danh sách icon có sẵn.';
