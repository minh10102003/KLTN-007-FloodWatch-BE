# Roadmap ý tưởng nâng cấp FloodWatch (KLTN)

File này tổng hợp các hướng mở rộng đã thảo luận để làm **lần lượt** và **tiện continue** (đánh dấu checkbox khi xong, ghi chú ngày/link PR ở cuối).

**Cách dùng:** làm theo thứ tự mục **Đề xuất thứ tự ưu tiên**, hoặc kéo mục lên đầu nếu team ưu tiên khác. Giữ phần **Nhật ký tiến độ** cập nhật mỗi lần pause.

---

## Mục lục

1. [Đề xuất thứ tự ưu tiên](#đề-xuất-thứ-tự-ưu-tiên)
2. [Nhóm A — Chữ ký kỹ thuật](#nhóm-a--chữ-ký-kỹ-thuật)
3. [Nhóm B — Vận hành & tin cậy](#nhóm-b--vận-hành--tin-cậy)
4. [Nhóm C — Tác động xã hội & demo](#nhóm-c--tác-động-xã-hội--demo)
5. [Nhóm D — Góc nghiên cứu / báo cáo](#nhóm-d--góc-nghiên-cứu--báo-cáo)
6. [Combo “ăn điểm” gợi ý](#combo-ăn-điểm-gợi-ý)
7. [Nhật ký tiến độ](#nhật-ký-tiến-độ)

---

## Đề xuất thứ tự ưu tiên

Làm tuần tự để mỗi bước có thể demo được; có thể song song nhóm B với một mục A.


| Thứ tự | Mã  | Nội dung ngắn                                            |
| ------ | --- | -------------------------------------------------------- |
| 1      | A1  | Fusion cảm biến + crowdsourcing (trọng số động)          |
| 2      | A2  | Độ tin cậy báo cáo / reputation                          |
| 3      | A3  | Dự báo ngắn hạn 15–60 phút                               |
| 4      | B1  | Health & telemetry thiết bị                              |
| 5      | B2  | Idempotency / outbox MQTT                                |
| 6      | B3  | Rate limit + chống abuse (report công khai)              |
| 7      | C1  | Thông báo đa kênh (email / webhook / Telegram…)          |
| 8      | C2  | Heatmap / aggregate theo lưới hoặc phường + timeline 24h |
| 9      | D1  | Đánh giá định lượng (MAE/RMSE, so sánh mô hình)          |
| 10     | D2  | Bài toán cold start + narrative báo cáo                  |


---

## Nhóm A — Chữ ký kỹ thuật

### A1. Fusion dữ liệu cảm biến + crowdsourcing (trọng số động)

- **Mục tiêu:** Hợp nhất mức nước “tin cậy” theo vùng; không chỉ hiển thị 2 nguồn tách rời.
- **Ý tưởng:** Trọng số động — ví dụ báo cáo đám đông gần cảm biến bị giảm trọng số nếu lệch quá xa so với cảm biến; tăng trọng số crowd ở khu không có cảm biến.
- **Gợi ý kỹ thuật:** Bắt đầu với công thức đơn giản (Kalman / Bayesian update) trên dữ liệu đã có (`flood_logs`, `crowd_reports`, PostGIS khoảng cách).
- **Chứng minh:** Biểu đồ hoặc API so sánh “trước fusion / sau fusion” theo thời gian hoặc theo cell.

**Trạng thái triển khai (backend):**

- [x] API `GET /api/v1/fusion/points` — `crowd[].crowd_only_cm` vs `crowd[].fused_cm`, `weights`, `coverage` (`blended` | `crowd_only_far` | `crowd_only_no_sensor`); `sensors[]` giữ `water_level_sensor_only_cm` / `water_level_fused_cm` (tại trạm trùng nhau).
- [x] PostGIS: cảm biến gần nhất + `ST_Distance` / `<->`; code `src/repositories/fusionRepository.js`, `src/services/fusionService.js`, `src/routes/fusionRoutes.js`.
- [x] Tuỳ chỉnh `.env`: `FUSION_R_MAX_M`, `FUSION_DECAY_DIST_M`, `FUSION_DISAGREE_SCALE_CM` (xem `.env.example`).
- [ ] FE: vẽ lớp bản đồ hoặc biểu đồ so sánh từ API (làm tiếp khi rảnh).
- [ ] (Tuỳ chọn) Fusion theo ô lưới / hex thay vì theo từng report.

---

### A2. Độ tin cậy báo cáo (reputation / consistency)

- **Mục tiêu:** Mỗi báo cáo (hoặc user) có `confidence`; giảm spam / báo sai.
- **Ý tưởng:** Điểm uy tín theo thời gian: khớp ảnh, vị trí, xác nhận moderator, trùng xu hướng với cảm biến gần đó.
- **Gợi ý kỹ thuật:** Cột hoặc bảng phụ trên `users` / `crowd_reports`; middleware hoặc service tính điểm khi tạo / duyệt report.
- **API:** Trả `confidence` trong response map/list report để FE tô màu hoặc filter.

**Trạng thái triển khai (backend):**

- [x] Tính `confidence` (0–100) + `confidence_breakdown` khi trả JSON — không thêm cột DB; logic `src/utils/reportConfidence.js`.
- [x] Gắn vào: `GET /api/crowd-reports`, `GET /api/crowd-reports/all`, `GET /api/reports/all`, `GET /api/reports/pending`, response sau `POST /api/reports/:id/moderate` (sau `withFullPhotoUrls`).
- [ ] (Tuỳ chọn) Điều chỉnh trọng số theo khoảng cách tới cảm biến giống fusion; cột `confidence` lưu DB nếu cần cache.

---

### A3. Dự báo ngắn hạn (15–60 phút)

- **Mục tiêu:** Cảnh báo kiểu “trong X phút có khả năng vượt ngưỡng”.
- **Ý tưởng:** Velocity từ lịch sử `flood_logs`; sau này có thể thêm yếu tố mưa (API thời tiết) nếu kịp.
- **Gợi ý kỹ thuật:** Không bắt buộc deep learning ngay — đủ heuristic + trend để ghi điểm “predictive”.
- **Endpoint gợi ý:** Ví dụ `GET /api/v1/forecast/sensor/:id?horizon=60` (tùy convention hiện tại).

**Trạng thái triển khai (backend):**

- [x] `GET /api/v1/forecast/sensor/:sensorId` — query `horizon` (15–120 phút, mặc định 60), `sample_minutes` (15–1440, mặc định 90).
- [x] Hồi quy tuyến tính trên `flood_logs` trong cửa sổ; `velocity_cm_per_hour`, `predicted_water_level_cm`, cờ vượt ngưỡng warning/danger trong horizon, `estimated_minutes_to_*` khi xu hướng tăng — `src/services/forecastService.js`, `floodRepository.getFloodLogsForForecast`, `forecastRoutes.js`.
- [ ] FE: badge / tooltip “dự báo 60 phút” trên bản đồ hoặc trang sensor.
- [ ] (Tuỳ chọn) Nguồn mưa / thời tiết ngoài.

---

## Nhóm B — Vận hành & tin cậy

### B1. Health & telemetry thiết bị ✅

- **Mục tiêu:** Theo dõi gateway, RSSI LoRa, packet loss, pin (nếu firmware đã gửi).
- **Gợi ý kỹ thuật:** Bảng hoặc mở rộng log; API `GET /health/sensors` hoặc `/api/admin/devices/health` (RBAC).
- **Demo:** Dashboard hoặc Swagger mô tả trạng thái “online / degraded / offline”.
- **Đã triển khai:** `GET /api/v1/admin/devices/health` (admin JWT), phân loại theo thời gian đo cuối từ `flood_logs` / `energy_logs` (RSSI, pin nếu có), env `HEALTH_ONLINE_MAX_MINUTES`, `HEALTH_DEGRADED_MAX_MINUTES`. Swagger tag **Device Health**.

---

### B2. Idempotency / outbox cho MQTT ✅

- **Mục tiêu:** Tránh trùng bản ghi khi reconnect / gửi lặp message.
- **Gợi ý kỹ thuật:** Message id + unique constraint hoặc bảng outbox; worker xử lý idempotent.
- **Báo cáo:** Một đoạn “đảm bảo tính nhất quán dữ liệu cảm biến”.
- **Đã triển khai:** Cột `flood_logs.ingest_key` + unique `(sensor_id, ingest_key)`; MQTT set `ingest_key` từ `msg_id` / seq / hash; `INSERT … ON CONFLICT DO NOTHING`. Migration: `npm run migrate:flood-ingest-key`.

---

### B3. Rate limit + chống abuse (endpoint báo cáo công khai) ✅

- **Mục tiêu:** Giới hạn spam report theo IP / user / fingerprint đơn giản.
- **Gợi ý kỹ thuật:** `express-rate-limit` hoặc tương đương; có thể kết hợp với A2.
- **Đã triển khai:** `express-rate-limit` theo IP (`keyGenerator` dùng `req.ip`) trên `POST /api/report-flood`; env `REPORT_FLOOD_WINDOW_MS`, `REPORT_FLOOD_MAX_PER_WINDOW`.

---

## Nhóm C — Tác động xã hội & demo

### C1. Thông báo đa kênh

- **Mục tiêu:** Luồng: vượt ngưỡng → thông báo tới người đăng ký.
- **Ý tưởng:** Email (đã có nền OTP), webhook generic, hoặc Telegram Bot / Zalo (mock hoặc tích hợp thật tùy thời gian).
- **Gợi ý kỹ thuật:** Tận dụng `emergency_subscriptions` (hoặc bảng tương đương); template + hàng đợi (optional).

---

### C2. Heatmap / aggregate không gian + timeline 24h

- **Mục tiêu:** API tổng hợp theo **hex grid** hoặc **phường** (PostGIS); trả chuỗi thời gian 24h cho demo bản đồ.
- **Gợi ý kỹ thuật:** Materialized view hoặc query aggregate; cache ngắn nếu cần.

---

## Nhóm D — Góc nghiên cứu / báo cáo

### D1. Đánh giá định lượng

- **Mục tiêu:** So sánh *chỉ cảm biến* vs *cảm biến + crowd có trọng số* (hoặc vs fusion A1).
- **Chỉ số gợi ý:** MAE, RMSE trên dữ liệu giả lập hoặc log vài ngày.
- **Deliverable:** 1 section trong luận văn + bảng/sơ đồ.

---

### D2. Cold start & vùng không có cảm biến

- **Mục tiêu:** Narrative rõ: crowdsourcing bù “lỗ hổng” mạng lưới IoT.
- **Việc cần làm:** Viết lại phần động lực + use case; có thể minh họa bằng query “vùng không sensor nhưng có report”.

---

## Combo “ăn điểm” gợi ý

Nếu thời gian hạn chế, ưu tiên **một trụ kỹ thuật + số liệu + demo**:

- **Trụ 1:** A1 (Fusion) + A2 (confidence) — API thống nhất cho bản đồ.
- **Trụ 2:** A3 (dự báo ngắn hạn đơn giản).
- **Bọc ngoài:** Một trang metrics trong admin hoặc mô tả rõ trong Swagger + slide bảo vệ 3–5 phút.

---

## Nhật ký tiến độ

*Ghi khi làm xong từng mục: ngày, nhánh/commit, ghi chú ngắn.*


| Ngày | Mã  | Trạng thái | Ghi chú |
| ---- | --- | ---------- | ------- |
|      |     |            |         |


---

## Ghi chú continue

- Đồng bộ `.env` với `.env.example` sau mỗi feature cần biến mới.
- Migration: thêm file SQL trong `database/` + script `scripts/runMigration*.js` nếu team đang theo pattern đó.
- Cập nhật Swagger (`src/config/swagger.js`) khi thêm endpoint công khai.

