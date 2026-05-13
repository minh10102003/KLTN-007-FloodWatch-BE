-- Tên hiển thị + metadata tùy chọn cho đăng ký cảnh báo khẩn (FE: getSubscriptionDisplayName).
-- Chạy: npm run migrate:emergency-subscription-name

ALTER TABLE emergency_subscriptions
    ADD COLUMN IF NOT EXISTS name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS display_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN emergency_subscriptions.name IS 'Tên do người dùng đặt cho đăng ký (hiển thị trên FE).';
COMMENT ON COLUMN emergency_subscriptions.display_meta IS 'JSON mở rộng cho FE (icon, màu, v.v.) — getSubscriptionDisplayName.';
