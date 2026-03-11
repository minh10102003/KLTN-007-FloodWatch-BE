-- Thêm cột is_online vào bảng users (user đang online = true khi đăng nhập, false khi đăng xuất)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN users.is_online IS 'Trạng thái online: true khi đăng nhập, false khi đăng xuất';
