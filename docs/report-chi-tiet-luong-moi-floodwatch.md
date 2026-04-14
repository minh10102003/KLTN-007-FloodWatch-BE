# Báo cáo kỹ thuật: các luồng nghiệp vụ mới FloodWatch (theo roadmap & tích hợp FE)

**Phiên bản tài liệu:** 1.0  
**Phạm vi:** Các mục đã triển khai backend trong `docs/enhancement-roadmap.md` (A1–A3, B1–B3, C1–C2, D1–D2), mô tả **làm gì — làm như thế nào — hoạt động ra sao**, và **liên hệ FE** (tham chiếu chỉ mục `docs/roadmap-nghiep-vu-va-huong-dan-fe.md`).

**Đối tượng đọc:** nhóm phát triển, giảng viên hướng dẫn, tài liệu đồ án.

---

## Mục lục

1. [Tóm tắt điều hành](#1-tóm-tắt-điều-hành)
2. [Kiến trúc & vai trò từng thành phần](#2-kiến-trúc--vai-trò-từng-thành-phần)
3. [Nhóm A — Dữ liệu thông minh trên bản đồ](#3-nhóm-a--dữ-liệu-thông-minh-trên-bản-đồ)
4. [Nhóm B — Vận hành & tin cậy](#4-nhóm-b--vận-hành--tin-cậy)
5. [Nhóm C — Tác động xã hội & thông báo](#5-nhóm-c--tác-động-xã-hội--thông-báo)
6. [Nhóm D — Nghiên cứu & đánh giá định lượng](#6-nhóm-d--nghiên-cứu--đánh-giá-định-lượng)
7. [Luồng end-to-end đặc biệt: MQTT → cảnh báo khẩn → đa kênh](#7-luồng-end-to-end-đặc-biệt-mqtt--cảnh-báo-khẩn--đa-kênh)
8. [Luồng Telegram: liên kết chat riêng từng user](#8-luồng-telegram-liên-kết-chat-riêng-từng-user)
9. [Phân tách trách nhiệm FE User vs FE Admin](#9-phân-tách-trách-nhiệm-fe-user-vs-fe-admin)
10. [Biến môi trường & migration liên quan](#10-biến-môi-trường--migration-liên-quan)
11. [Kiểm thử & xử lý sự cố](#11-kiểm-thử--xử-lý-sự-cố)

---

## 1. Tóm tắt điều hành

Hệ thống FloodWatch mở rộng theo roadmap nhằm:

| Nhóm | Giá trị nghiệp vụ |
|------|-------------------|
| **A** | Bản đồ không chỉ “điểm đo” mà còn **trộn** cảm biến + crowd, **đánh giá độ tin cậy** báo cáo, **dự báo ngắn hạn** theo trạm. |
| **B** | **Theo dõi sức khỏe thiết bị**, **chống trùng dữ liệu MQTT**, **giới hạn spam** báo cáo công khai. |
| **C** | **Thông báo đa kênh** khi nguy hiểm thật; **heatmap + timeline 24h** phục vụ demo tác động. |
| **D** | API **đánh giá định lượng** (MAE/RMSE) và **điểm nóng cold-start** phục vụ luận văn / báo cáo. |

Backend triển khai chủ yếu trong `src/services`, `src/repositories`, `src/routes`; MQTT worker nằm trong `src/services/mqttService.js` (khởi động từ `server.js`).

---

## 2. Kiến trúc & vai trò từng thành phần

```text
[Thiết bị IoT] --MQTT--> [mqttService] --> [flood_logs] (+ ingest_key dedupe)
                              |
                              +--> [Cảnh báo ngưỡng] --> [emergency_subscriptions query]
                                        |
                                        +--> [emergencyNotificationService]
                                                  |-- email (Resend)
                                                  |-- webhook (HTTP POST env URL)
                                                  +-- telegram (Bot API, chat_id/user)

[FE / Mobile] --HTTPS JWT--> [REST API: fusion, forecast, heatmap, auth, subscriptions, research...]

[Telegram Cloud] --HTTPS webhook--> [POST /api/v1/telegram/webhook] --> [users.telegram_chat_id]
```

**Điểm quan trọng:** Phần lớn luồng “mới” **không thay thế** luồng MQTT lưu `flood_logs` cốt lõi; chúng **bổ sung** lớp tính toán (fusion, forecast), **bảo vệ** (idempotency, rate limit), **hành động** (notify), **trình bày** (heatmap, research).

---

## 3. Nhóm A — Dữ liệu thông minh trên bản đồ

### 3.1 A1 — Fusion điểm (`GET /api/v1/fusion/points`)

**Mục tiêu nghiệp vụ:** Tại mỗi vùng có báo cáo đám đông đã duyệt, trả về mức nước **sau khi hợp nhất** với cảm biến gần nhất theo trọng số (gần đúng, xa lệch, không có sensor).

**Làm như thế nào (logic tổng quát):**

- Repository PostGIS tìm **cảm biến gần nhất** theo khoảng cách địa lý tới từng report.
- Service áp dụng hàm suy giảm trọng số theo khoảng cách và độ lệch giữa crowd vs sensor (tham số env: `FUSION_R_MAX_M`, `FUSION_DECAY_DIST_M`, `FUSION_DISAGREE_SCALE_CM`).
- Mỗi điểm crowd có các trường kiểu: mức chỉ crowd, mức fused, trọng số, `coverage` (phân loại nguồn tin dùng).

**Hoạt động ra sao khi FE gọi API:**

- FE gửi request (thường theo bbox hoặc toàn vùng — theo contract API/Swagger).
- Server trả JSON: mảng **sensors** và **crowd** (hoặc cấu trúc tương đương trong Swagger) để vẽ lớp bản đồ “trộn dữ liệu”.
- **Không** ghi DB tại bước fusion (đọc từ `flood_logs`, `crowd_reports`, `sensors`).

**Rủi ro / lưu ý:** Nếu không có báo cáo đã duyệt hoặc không có sensor trong phạm vi cấu hình, response vẫn hợp lệ nhưng ít điểm “blended”.

---

### 3.2 A2 — Độ tin cậy báo cáo (`confidence`)

**Mục tiêu nghiệp vụ:** Hỗ trợ người xem và moderator đánh giá nhanh “tin cậy” của một báo cáo đám đông mà **không bắt buộc** thêm cột DB mới (tính khi trả response).

**Làm như thế nào:**

- Module `src/utils/reportConfidence.js` tính `confidence` (0–100) và `confidence_breakdown` từ metadata báo cáo (ảnh, vị trí, trạng thái duyệt, v.v. — theo logic đã cài).

**Hoạt động ra sao:**

- Các endpoint list/pending/moderate (xem roadmap) **bọc** dữ liệu trước khi trả JSON → FE nhận thêm hai trường trên mỗi report phù hợp.

**FE:** badge màu, tooltip; moderator có thể sort/filter theo confidence.

---

### 3.3 A3 — Dự báo ngắn hạn (`GET /api/v1/forecast/sensor/:sensorId`)

**Mục tiêu nghiệp vụ:** Dựa trên chuỗi `flood_logs` gần đây, ước lượng xu hướng mực nước trong **horizon** phút tới (mặc định 60), cửa sổ lịch sử `sample_minutes` (mặc định 90).

**Làm như thế nào:**

- `forecastService` + `floodRepository.getFloodLogsForForecast`: hồi quy **tuyến tính** đơn giản trên mốc thời gian → suy ra vận tốc (cm/giờ), mực dự báo, cờ vượt ngưỡng trong horizon, thời gian ước lượng tới warning/danger nếu xu hướng tăng.

**Hoạt động ra sao:**

- FE truyền `sensorId` và query tùy chọn → nhận object dự báo để hiển thị badge “dự báo ~X phút” hoặc cảnh báo sớm trên UI trạm.

**Rủi ro:** Ít điểm dữ liệu trong cửa sổ → dự báo kém ổn định; cần hiển thị disclaimer cho user.

---

## 4. Nhóm B — Vận hành & tin cậy

### 4.1 B1 — Health thiết bị (`GET /api/v1/admin/devices/health`)

**Mục tiêu:** Cho admin biết trạm **online / degraded / offline / inactive** dựa trên **thời điểm đo cuối** trong `flood_logs` và (nếu có) `energy_logs`.

**Cách hoạt động:** So `now - last_data_time` với ngưỡng phút từ env (`HEALTH_ONLINE_MAX_MINUTES`, `HEALTH_DEGRADED_MAX_MINUTES`), phân loại.

**FE Admin:** bảng + filter; **JWT role admin**.

---

### 4.2 B2 — Idempotency MQTT (`ingest_key`)

**Mục tiêu:** Khi broker MQTT gửi **trùng** message (reconnect, retry firmware), không tạo **hai bản ghi** `flood_logs` cho cùng một “sự kiện đo”.

**Làm như thế nào (`mqttService.js`):**

1. Hàm `buildMqttIngestKey(sensorId, data, rawDistanceForDedupe)` tạo khóa:
   - Ưu tiên `msg_id` / `message_id` / `seq` / `dedupe_id` từ payload → hash ngắn.
   - Nếu không có → hash từ `(sensor_id, giây timestamp, raw cm làm tròn)`.
2. `floodRepository.createFloodLog` dùng `INSERT ... ON CONFLICT` trên ràng buộc unique `(sensor_id, ingest_key)` (sau migration).
3. Nếu insert bị bỏ qua (`log` null) → log `Dedupe skip` và **dừng** xử lý message đó (không tính lại alert/notify cho bản trùng).

**Hệ quả nghiệp vụ:** Dữ liệu hiển thị và luồng cảnh báo **không nhân đôi** vì MQTT lặp.

**FE:** không có API; chỉ thấy dữ liệu ổn định hơn.

---

### 4.3 B3 — Rate limit `POST /api/report-flood`

**Mục tiêu:** Hạn chế spam báo cáo công khai theo **IP** trong cửa sổ thời gian.

**Cách hoạt động:** Middleware `express-rate-limit` (`REPORT_FLOOD_WINDOW_MS`, `REPORT_FLOOD_MAX_PER_WINDOW`).

**FE User:** bắt **HTTP 429**, hiển thị thông báo chờ; tránh double-submit.

---

## 5. Nhóm C — Tác động xã hội & thông báo

### 5.1 C2 — Heatmap & timeline (`/api/heatmap/*`)

**Mục tiêu nghiệp vụ:**

- **Heatmap:** tổng hợp không gian mật độ / cường độ (từng endpoint `GET /api/heatmap`, `GET /api/heatmap/combined`).
- **Timeline 24h:** chuỗi theo **giờ** trong 24 giờ gần nhất, gộp sensor + crowd đã duyệt — `GET /api/heatmap/timeline-24h`.

**Làm như thế nào:** Controller/repository aggregate trên DB (PostGIS / time bucket — chi tiết trong code heatmap).

**FE:** lớp màu trên map + biểu đồ thời gian; có thể dùng chung cho user và admin demo.

---

### 5.2 C1 — Thông báo đa kênh (chi tiết nghiệp vụ)

#### 5.2.1 Đăng ký vùng (`emergency_subscriptions`)

**Mục tiêu:** User chọn **một điểm** (lat/lng) và **bán kính** (mét), chọn **các kênh** nhận tin (`email`, `webhook`, `telegram`, …).

**API:** `POST/GET/PUT/DELETE` dưới `/api/emergency-subscriptions` (có JWT).

**Cách lưu:** Mỗi bản ghi có `location` (PostGIS), `radius`, `notification_methods` (JSON/array), `is_active`.

#### 5.2.2 Khi nào hệ thống “đánh thức” notifier?

Sau khi một tin MQTT được xử lý **thành công** (đã insert `flood_logs`, không phải dedupe skip), trong `mqttService.js`:

1. Tính `water_level`, `velocity`, `status` (`normal` | `warning` | `danger`) từ ngưỡng sensor (`sensorRepository.getThresholds`) hoặc mặc định nếu thiếu ngưỡng.
2. **Điều kiện gửi cảnh báo khẩn:**

   `status === 'danger'` **HOẶC** (`status === 'warning'` **VÀ** `velocity > 5`) — đơn vị velocity: **cm/phút** (tính từ log cách ~5 phút).

3. Lấy `sensor` theo `sensor_id`, gọi `findUsersInAlertRadius(sensor.lng, sensor.lat, 2000)`:
   - SQL: khoảng cách từ **điểm đăng ký** tới **sensor** ≤ `GREATEST(es.radius, 2000)` mét.
   - Nghĩa là **bán kính hiệu dụng** = max(bán kính user, 2000m). User chọn 500m vẫn có “sàn” 2km; user chọn 5000m thì dùng 5000m.

4. Với mỗi subscriber:
   - Xác định `alert_kind`: `danger` hoặc `warning_velocity` (dedupe tách loại).
   - Gọi `wasSentRecently(sensor_id, user_id, alert_kind, cooldown)` — bảng `emergency_alert_send_log`; nếu true → **bỏ qua** (cooldown).
   - Gọi `notifySubscriber(subscriber, payload)` — payload gồm `sensorId`, `locationName`, `status`, `waterLevel`, `velocity`, tọa độ, `triggeredAt`, `alert_kind`.
   - Nếu **ít nhất một kênh** `ok` → `recordSuccessfulSend` (ghi log dedupe + thống kê admin).

#### 5.2.3 `emergencyNotificationService.notifySubscriber`

**Normalize** `notification_methods` → chữ thường.

- **`email`:** Resend — cần `RESEND_API_KEY`, `OTP_FROM_EMAIL`; gửi tới `subscriber.email`.
- **`webhook`:** `POST` JSON tới `EMERGENCY_WEBHOOK_URL`, tùy chọn `EMERGENCY_WEBHOOK_BEARER`; body gồm payload + `subscriber_user_id`.
- **`telegram`:** `sendMessage` tới `subscriber.telegram_chat_id` nếu có; không có thì fallback `TELEGRAM_CHAT_ID` env; không có cả hai → kênh fail với lý do rõ.

**Retry:** mỗi kênh retry tối đa `EMERGENCY_NOTIFY_MAX_RETRIES`, backoff `EMERGENCY_NOTIFY_RETRY_BASE_MS`.

**Song song:** các kênh chạy `Promise.allSettled` — một kênh lỗi không chặn kênh khác.

#### 5.2.4 Admin thống kê

`GET /api/v1/admin/emergency-alerts/summary?hours=` — JWT admin; đọc tổng hợp từ `emergency_alert_send_log` (sau khi có migration).

---

## 6. Nhóm D — Nghiên cứu & đánh giá định lượng

### 6.1 D1 — `GET /api/v1/research/evaluation`

**Mục tiêu:** Trong bbox và khung thời gian (`crowd_hours`, `sensor_hours`), so sánh **sai số** (MAE, RMSE, bias) giữa baseline crowd-only và fused so với tham chiếu cảm biến gần nhất.

**Cách dùng:** GET công khai (không yêu cầu auth trong route research — kiểm tra Swagger nếu thay đổi); FE truyền bbox để giới hạn vùng TP.HCM.

### 6.2 D2 — `GET /api/v1/research/cold-start-hotspots`

**Mục tiêu:** Tìm cụm báo cáo đã duyệt **xa** mọi cảm biến hơn `no_sensor_radius_m`, trong `report_hours`, tối thiểu `min_reports` điểm — minh họa “vùng không có IoT nhưng có người báo”.

**FE:** overlay hoặc bảng; phục vụ narrative luận văn.

---

## 7. Luồng end-to-end đặc biệt: MQTT → cảnh báo khẩn → đa kênh

**Bước 1 — Nhận MQTT:** Topic `hcm/flood/data`, JSON có `sensor_id`, `value` (khoảng cách đo), tùy chọn `checksum`, `timestamp`, `temperature`, `humidity`.

**Bước 2 — Kiểm tra & làm sạch:** Checksum (nếu có); `filterNoise` (loại ≤0 hoặc >500cm); Kalman theo `sensor_id`.

**Bước 3 — Mực nước:** `water_level = max(0, installationHeight - filteredDistance)`.

**Bước 4 — Vận tốc:** So log ~5 phút trước → cm/phút.

**Bước 5 — Trạng thái:** So với `warning_threshold`, `danger_threshold` của sensor.

**Bước 6 — Ghi log:** `ingest_key` → insert idempotent; nếu trùng → **return** (không chạy bước 7 cho message này).

**Bước 7 — Cảnh báo khẩn (nếu điều kiện ngưỡng):** Query subscribers trong vùng → dedupe → `notifySubscriber` → ghi log thành công.

**Bước 8 — Log vận hành:** Console log mực/status/velocity cho monitoring.

---

## 8. Luồng Telegram: liên kết chat riêng từng user

**Mục tiêu:** Mỗi user đã đăng nhập có thể nhận `sendMessage` vào **chat DM** với bot, không phụ thuộc một `chat_id` cố định trên server (vẫn có thể fallback env).

**Các thành phần:**

| Thành phần | Vai trò |
|------------|---------|
| `POST /api/auth/telegram/link` | Tạo token ngắn hạn trong `telegram_link_tokens`, trả `deep_link` (`t.me/<bot>?start=<token>`). |
| User mở Telegram /start | Telegram gửi `Update` tới webhook. |
| `POST /api/v1/telegram/webhook` | Xác thực header `X-Telegram-Bot-Api-Secret-Token` (nếu env có); `handleUpdate` đọc `/start <token>`, gán `users.telegram_chat_id`, `markConsumed` token. |
| `/start` không token | Bot trả hướng dẫn mở app “Liên kết Telegram”. |
| `GET /api/auth/telegram/status` | Trả `telegram_linked`, `telegram_username`. |
| `DELETE /api/auth/telegram/unlink` | Xóa liên kết + token pending. |

**DB:** migration `telegram-per-user` (cột user + bảng token).

**Bảo mật:** `secret_token` của Telegram chỉ cho phép ký tự giới hạn (A–Z, a–z, 0–9, `_`, `-`).

Chi tiết vận hành & env: `docs/group-c-notification-flow.md`.

---

## 9. Phân tách trách nhiệm FE User vs FE Admin

| Hạng mục | FE User (công dân / người xem bản đồ) | FE Admin / Moderator |
|----------|----------------------------------------|-------------------------|
| Fusion, forecast, heatmap, timeline | Bật lớp bản đồ, biểu đồ | Có thể tái sử dụng widget hoặc trang nội bộ |
| Confidence | Xem badge trên báo cáo công khai | Duyệt, lọc theo confidence |
| Đăng ký cảnh báo + Telegram | CRUD subscription, liên kết bot | — |
| Device health | — | Trang health + JWT admin |
| Emergency alert summary | — | Trang thống kê + JWT admin |
| Research D1/D2 | (Tuỳ) trang minh họa | Báo cáo / slide |

Bảng API tổng hợp ngắn: `docs/roadmap-nghiep-vu-va-huong-dan-fe.md` §1.

---

## 10. Biến môi trường & migration liên quan

**Fusion:** `FUSION_R_MAX_M`, `FUSION_DECAY_DIST_M`, `FUSION_DISAGREE_SCALE_CM`.

**Health:** `HEALTH_ONLINE_MAX_MINUTES`, `HEALTH_DEGRADED_MAX_MINUTES`.

**MQTT dedupe:** migration `flood-ingest-key`.

**Rate limit report:** `REPORT_FLOOD_WINDOW_MS`, `REPORT_FLOOD_MAX_PER_WINDOW`.

**Notify:** `RESEND_API_KEY`, `OTP_FROM_EMAIL`, `EMERGENCY_WEBHOOK_URL`, `EMERGENCY_WEBHOOK_BEARER`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_CHAT_ID` (tuỳ chọn), `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_LINK_TTL_MINUTES`, `EMERGENCY_ALERT_COOLDOWN_MINUTES`, `EMERGENCY_NOTIFY_MAX_RETRIES`, `EMERGENCY_NOTIFY_RETRY_BASE_MS`.

**Migrations:** `migrate:emergency-alert-send-log`, `migrate:telegram-per-user`.

Mẫu env: `.env.example`.

---

## 11. Kiểm thử & xử lý sự cố

**Fusion / forecast / heatmap / research:** So sánh response Swagger với FE; kiểm bbox và thời gian.

**Cảnh báo email không tới:** (1) điều kiện ngưỡng + velocity; (2) sensor trong `GREATEST(radius,2000)m` của **điểm ghim**; (3) `notification_methods` có `email`; (4) Resend env; (5) cooldown; (6) log Railway `📢` / `Notify failed`.

**Telegram:** `getWebhookInfo`; secret header; user đã `/start` với token; subscription có `telegram`.

**429 report:** Giảm tần suất thử từ cùng IP.

**Routing AMC-A\* chưa trả đường:**

1. Chạy migration: `npm run migrate:road-graph`.
2. Import graph: `npm run import:road-graph -- --file <roads.geojson|roads.osm> [--clear-existing]`.
3. Kiểm tra `road_nodes`, `road_edges` đã có dữ liệu.
4. Nếu muốn mô phỏng ngập nhanh theo batch (không chờ sensor), dùng admin API:
   - `PUT /api/v1/admin/routing/manual-flood-depths/batch`
   - body: `{ "updates": [ { "edge_id": 101, "manual_flood_depth_cm": 35 }, { "edge_id": 102, "manual_flood_depth_cm": null } ] }`
   - `null` = bỏ ghi đè, quay về đọc từ `flood_logs` qua `flood_sensor_id`.

---

## Phụ lục A — Liên kết tài liệu nội bộ

| Tài liệu | Nội dung |
|----------|-----------|
| `docs/roadmap-nghiep-vu-va-huong-dan-fe.md` | Bản đồ API ↔ FE, checklist triển khai |
| `docs/enhancement-roadmap.md` | Checkbox tiến độ roadmap |
| `docs/group-c-notification-flow.md` | Luồng C1 chi tiết + Telegram |
| `docs/group-d-research-feature-fe-guide.md` | Gợi ý nhóm D cho FE |
| `/api-docs` | Swagger thời gian thực |

---

## Phụ lục B — Ghi chú pháp lý / báo cáo

Tài liệu này mô tả hành vi hệ thống theo mã nguồn tại thời điểm biên soạn. Khi refactor route hoặc đổi contract JSON, cần cập nhật lại mục API và sơ đồ luồng tương ứng.

---

*Tài liệu được sinh để bổ sung cho `docs/roadmap-nghiep-vu-va-huong-dan-fe.md`, đáp ứng yêu cầu báo cáo chi tiết về luồng nghiệp vụ mới.*
