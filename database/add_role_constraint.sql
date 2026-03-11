-- Chuẩn hóa role: chỉ cho phép 3 giá trị user, moderator, admin
-- Chạy sau khi đảm bảo không có user nào có role khác 3 giá trị trên

-- Xóa constraint cũ nếu đã tồn tại (để chạy lại migration an toàn)
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_role;

-- Thêm ràng buộc role
ALTER TABLE users ADD CONSTRAINT chk_user_role
    CHECK (role IN ('user', 'moderator', 'admin'));

COMMENT ON CONSTRAINT chk_user_role ON users IS 'Chỉ cho phép role: user, moderator, admin';
