# Nhóm C - Luồng thông báo đa kênh (C1) và timeline heatmap (C2)

Tài liệu này giải thích rõ phần Nhóm C đã triển khai ở backend: nó làm gì, **vai trò trong tổng thể hệ thống**, cách bật Webhook/Telegram, dedupe/retry, API thống kê admin, và phần còn lại (queue chuyên dụng) nếu cần mở rộng.

---

## 0) Luồng Nhóm C đứng ở đâu trong hệ thống — nó làm gì?

Nhóm C là **lớp “hành động” và “trình diễn dữ liệu theo thời gian”** nằm trên nền tảng đã có của hệ thống giám sát ngập:

| Thành phần hệ thống | Vai trò | Liên hệ với Nhóm C |
|----------------------|---------|---------------------|
| **Cảm biến + MQTT + `flood_logs`** | Thu thập mực nước thời gian thực | C1: khi vượt ngưỡng → kích hoạt cảnh báo; C2: nguồn cho timeline/heatmap |
| **`emergency_subscriptions` + user** | Người dùng đăng ký vùng nhận tin | C1: danh sách người cần nhận thông báo theo bán kính |
| **Kênh ngoài (email / webhook / Telegram)** | Đưa cảnh báo ra khỏi backend | C1: tích hợp vận hành, Zalo/Slack qua webhook, v.v. |
| **FE bản đồ / dashboard** | Hiển thị cho người xem | C2: `timeline-24h` + heatmap; Admin: thống kê gửi cảnh báo |

**Tóm lại:** Nhóm C **không thay thế** cảm biến hay bản đồ chính; nó **kết nối tín hiệu ngập đã xử lý** với **người đăng ký** và **công cụ bên ngoài**, đồng thời cung cấp **dữ liệu tổng hợp theo giờ** để demo tác động xã hội.

---

## 1) Mục tiêu của luồng Nhóm C

### C1 - Thông báo đa kênh
- Biến sự kiện kỹ thuật (sensor vượt ngưỡng) thành hành động thực tế (gửi cảnh báo cho người dùng).
- Cho phép mở rộng kênh thông báo theo nhu cầu: `email`, `webhook`, `telegram`.

### C2 - Heatmap timeline 24h
- Cung cấp dữ liệu tổng hợp theo thời gian để demo tác động xã hội.
- Hỗ trợ FE vẽ timeline theo giờ, không chỉ xem trạng thái tức thời.

---

## 2) Luồng C1 hiện đang chạy như thế nào

1. Sensor gửi dữ liệu qua MQTT.
2. Backend xử lý dữ liệu, tính trạng thái (`normal` / `warning` / `danger`) và vận tốc.
3. Khi đạt điều kiện cảnh báo:
   - `danger`, hoặc
   - `warning` và vận tốc tăng cao.
4. Backend tìm người nhận theo vùng đăng ký (`emergency_subscriptions`).
5. Với từng subscriber, xác định **loại cảnh báo** (`alert_kind`): `danger` hoặc `warning_velocity` — dùng cho dedupe.
6. **Dedupe (chống spam):** nếu đã gửi **thành công** cùng `sensor_id + user_id + alert_kind` trong cửa sổ `EMERGENCY_ALERT_COOLDOWN_MINUTES` (mặc định 20 phút) thì **bỏ qua** lần gửi tiếp theo (log `Cooldown skip`).
7. Với từng subscriber còn lại, backend đọc `notification_methods` và gửi theo kênh đã chọn:
   - `email`: gửi qua Resend.
   - `webhook`: `POST` JSON sang URL ngoài.
   - `telegram`: gọi Telegram Bot API (`sendMessage`).
8. **Retry nhẹ:** mỗi kênh thử lại tối đa `EMERGENCY_NOTIFY_MAX_RETRIES` lần, backoff tuyến tính theo `EMERGENCY_NOTIFY_RETRY_BASE_MS` (lỗi mạng tạm thời).
9. Nếu một kênh lỗi, luồng vẫn tiếp tục với kênh khác (fail mềm, có log cảnh báo).
10. Nếu **ít nhất một kênh gửi thành công**, ghi một dòng vào bảng `emergency_alert_send_log` (kèm `channels_summary` JSON rút gọn) để phục vụ dedupe và thống kê admin.
11. **Admin:** `GET /api/v1/admin/emergency-alerts/summary?hours=24` — tổng số lần gửi thành công đã ghi + nhóm theo `alert_kind` (cần JWT admin).

### Giá trị thực tế
- Người dân/đơn vị phản ứng nhanh hơn khi có cảnh báo.
- Dễ tích hợp với hệ thống khác nhờ webhook (không bị khóa vào một nền tảng).

---

## 3) "Webhook" là gì?

Webhook là một endpoint HTTP (URL) nhận dữ liệu theo sự kiện.

Trong dự án này:
- Khi có cảnh báo, backend tự gửi `POST` đến `EMERGENCY_WEBHOOK_URL`.
- Body là JSON chứa thông tin cảnh báo (sensor, mức nước, tọa độ, thời gian...).
- Hệ thống nhận webhook có thể:
  - gửi thông báo tiếp qua Zalo/Slack/Discord,
  - lưu vào Google Sheet,
  - kích hoạt workflow tự động,
  - tạo ticket/incident.

Nói ngắn: webhook là "cầu nối tự động giữa FloodWatch và công cụ khác".

---

## 4) Cấu hình để bật Webhook

Set biến môi trường:
- `EMERGENCY_WEBHOOK_URL=https://your-endpoint.example.com/alert`
- `EMERGENCY_WEBHOOK_BEARER=<token>` (tuỳ chọn)

Và trong subscription của user:
- `notification_methods` chứa `webhook`
- ví dụ: `["email", "webhook"]`

### Khi nào nên dùng webhook?
- Muốn đẩy cảnh báo sang hệ thống riêng hoặc workflow tự động.
- Muốn nối nhanh nhiều dịch vụ mà không sửa backend nhiều.

---

## 5) Cấu hình để bật Telegram Bot

### Gửi tin **theo từng user** (khuyến nghị)

Mỗi tài khoản đã đăng nhập có thể **liên kết chat riêng** với bot (kênh thông báo cá nhân). Backend lưu `users.telegram_chat_id` và khi subscription có `telegram`, tin cảnh báo gửi vào **chat đó**.

**Biến môi trường:**
- `TELEGRAM_BOT_TOKEN` — token từ BotFather.
- `TELEGRAM_BOT_USERNAME` — username bot **không** có `@` (để tạo deep link `https://t.me/<bot>?start=<token>`).
- `TELEGRAM_WEBHOOK_SECRET` (khuyến nghị) — truyền vào `setWebhook` làm `secret_token`; backend kiểm tra header `X-Telegram-Bot-Api-Secret-Token`. Telegram **chỉ** cho phép trong secret: chữ và số, `_`, `-` (không dùng chuỗi base64 có `=`).
- `TELEGRAM_LINK_TTL_MINUTES` (tuỳ chọn, mặc định 15) — thời hạn token `/start`.

**DB:** chạy `npm run migrate:telegram-per-user` (thêm cột + bảng `telegram_link_tokens`).

**Luồng FE / user:**
1. User đăng nhập → `POST /api/auth/telegram/link` → nhận `deep_link`.
2. Mở link trong Telegram → `/start <token>` → Telegram gọi `POST /api/v1/telegram/webhook` (HTTPS công khai) → backend gán `telegram_chat_id` cho user.
3. `GET /api/auth/telegram/status` — `telegram_linked` / `telegram_username`.
4. `DELETE /api/auth/telegram/unlink` — gỡ liên kết.

**Cấu hình Bot trên Telegram:**
- `setWebhook` trỏ tới `https://<API-công-khai>/api/v1/telegram/webhook` và cùng `secret_token` với env.

### Fallback: một chat / nhóm chung (demo)

- `TELEGRAM_CHAT_ID=<chat_id user/group>` — nếu user **chưa** liên kết chat riêng nhưng subscription vẫn có `telegram`, tin sẽ gửi vào chat này (tương thích bản cũ).

Và trong subscription:
- `notification_methods` chứa `telegram`
- ví dụ: `["telegram"]` hoặc `["email", "telegram"]`

### Các bước lấy chat id chung (chỉ khi dùng `TELEGRAM_CHAT_ID`)
1. Mở Telegram, nhắn `@BotFather`.
2. Chạy `/newbot`, đặt tên bot, lấy token.
3. Add bot vào chat hoặc group muốn nhận cảnh báo.
4. Gửi 1 tin nhắn trong chat/group đó.
5. Mở URL:
   - `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
6. Tìm `chat.id` trong response JSON.

---

## 6) Nên dùng webhook nào? (ưu tiên free)

### Đề xuất theo nhu cầu
- **Test nhanh payload**: [Webhook.site](https://webhook.site/) (free, cực nhanh để debug).
- **Tạo workflow no-code nhẹ**: [Pipedream](https://pipedream.com/) (free tier tốt cho demo).
- **Tự host, chủ động dữ liệu**: [n8n](https://n8n.io/) self-host (open-source, free nếu tự triển khai).
- **Automation phổ biến**: [Make](https://www.make.com/) (free tier có giới hạn operation).

### Khuyến nghị cho đồ án (thực dụng)
- Giai đoạn demo: dùng Webhook.site hoặc Pipedream để chứng minh luồng chạy.
- Giai đoạn vận hành lâu dài: chuyển sang n8n self-host (hoặc server webhook riêng) để chủ động và ổn định.

---

## 7) C2 - Timeline 24h đã có gì

Đã có endpoint:
- `GET /api/heatmap/timeline-24h`

Ý nghĩa:
- Trả chuỗi theo giờ trong 24h gần nhất.
- Gộp từ:
  - `flood_logs` (sensor),
  - `crowd_reports` đã duyệt.

Mục đích:
- FE có thể làm chart/timeline playback để trình bày tác động theo thời gian.

---

## 8) Trạng thái hiện tại và kế hoạch tiếp theo

### Trạng thái (đã bổ sung so với bản trước)
- Nhóm C1: đa kênh + **dedupe theo DB** + **retry từng kênh** + **API thống kê admin**.
- Nhóm C2: heatmap + timeline 24h như trước.
- **Chưa có** hàng đợi chuyên dụng (Redis/Bull/SQS) và dead-letter queue — chỉ retry đồng bộ trong request MQTT (đủ cho đồ án / tải vừa).

### Migration bắt buộc cho dedupe + thống kê
- Local / CI: `npm run migrate:emergency-alert-send-log`
- Production: `npm run migrate:emergency-alert-send-log` (DATABASE_URL Neon)

Nếu chưa migrate: hệ thống **vẫn gửi cảnh báo** nhưng **không dedupe** (log cảnh báo thiếu bảng).

### Migration cho Telegram từng user
- Local: `npm run migrate:telegram-per-user`
- Production: `npm run migrate:telegram-per-user` (DATABASE_URL Neon)

### Việc còn lại (tuỳ chọn, tải cao / production nặng)
1. Queue bất đồng bộ + worker riêng (tránh chặn luồng MQTT).
2. Dead-letter + dashboard chi tiết theo từng kênh (email vs webhook vs telegram).

**Telegram theo user:** đã có (deep link + webhook + `users.telegram_chat_id`); vẫn hỗ trợ fallback `TELEGRAM_CHAT_ID`.

---

## 9) Checklist vận hành & demo

- [ ] Chạy migration `emergency_alert_send_log` trên mọi môi trường production.
- [ ] Chọn nền tảng webhook chính thức (Pipedream/n8n/server riêng).
- [ ] Cấu hình production cho `EMERGENCY_WEBHOOK_URL`, `EMERGENCY_WEBHOOK_BEARER` (nếu dùng webhook).
- [ ] Tạo bot Telegram production; `setWebhook` + `TELEGRAM_WEBHOOK_SECRET` (nếu dùng liên kết per-user).
- [ ] Cập nhật `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`; migration `telegram-per-user`.
- [ ] (Tuỳ chọn) `TELEGRAM_CHAT_ID` cho nhóm/demo khi user chưa liên kết chat riêng.
- [ ] Chỉnh `EMERGENCY_ALERT_COOLDOWN_MINUTES` / retry env cho phù hợp demo.
- [ ] Gọi `GET /api/v1/admin/emergency-alerts/summary` sau buổi test sensor để chụp số liệu cho báo cáo.
- [ ] Chạy test cảnh báo thật với sensor (danger / warning + vận tốc).

