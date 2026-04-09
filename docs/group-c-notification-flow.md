# Nhóm C - Luồng thông báo đa kênh (C1) và timeline heatmap (C2)

Tài liệu này giải thích rõ phần Nhóm C đã triển khai ở backend: nó làm gì, dùng để làm gì, cách bật Webhook/Telegram, và kế hoạch tạm dừng để ưu tiên Nhóm D rồi quay lại hoàn thiện.

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
5. Với từng subscriber, backend đọc `notification_methods` và gửi theo kênh đã chọn:
   - `email`: gửi qua Resend.
   - `webhook`: `POST` JSON sang URL ngoài.
   - `telegram`: gọi Telegram Bot API (`sendMessage`).
6. Nếu một kênh lỗi, luồng vẫn tiếp tục với kênh khác (fail mềm, có log cảnh báo).

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

Set biến môi trường:
- `TELEGRAM_BOT_TOKEN=<token từ BotFather>`
- `TELEGRAM_CHAT_ID=<chat_id user/group>`

Và trong subscription:
- `notification_methods` chứa `telegram`
- ví dụ: `["telegram"]` hoặc `["email", "telegram"]`

### Các bước lấy Telegram Bot token và chat id
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

### Trạng thái
- Nhóm C backend đã có nền tảng hoạt động.
- Chưa tối ưu queue/retry/dead-letter cho thông báo tải cao.

### Quyết định tạm thời
- **Tạm dừng Nhóm C tại đây để ưu tiên Nhóm D trước**.
- Sau khi hoàn thành Nhóm D, quay lại hoàn thiện Nhóm C các phần:
  1. queue + retry,
  2. chống gửi trùng cảnh báo trong thời gian ngắn,
  3. dashboard theo dõi tỉ lệ gửi thành công từng kênh.

---

## 9) Checklist quay lại Nhóm C sau Nhóm D

- [ ] Chọn nền tảng webhook chính thức (Pipedream/n8n/server riêng).
- [ ] Cấu hình production cho `EMERGENCY_WEBHOOK_URL`, `EMERGENCY_WEBHOOK_BEARER`.
- [ ] Tạo bot Telegram production + group nhận cảnh báo.
- [ ] Cập nhật `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- [ ] Chạy test cảnh báo thật với sensor.
- [ ] Đo và ghi nhận tỉ lệ gửi thành công/thất bại.

