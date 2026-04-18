# API doc cho FE: Routing + Notification (tách User/Admin)

**Bản tổng hợp cập nhật cho FE (changelog + hành vi + test):** [`docs/fe-integration-update-full.md`](./fe-integration-update-full.md)

Tài liệu này gom các API cần cho FE sau các luồng mới (AMC-A* routing + notification C1), phân rõ quyền **User** và **Admin**.

Base URL ví dụ:

- Local: `http://localhost:3000`
- Production: `https://api.floodsight.id.vn`

JWT:

- API có bảo vệ cần header `Authorization: Bearer <access_token>`

---

## 1) FE User

## 1.1 Tìm đường an toàn (AMC-A*)

- **Method**: `GET`
- **Path**: `/api/v1/routing/safe-path`
- **Auth**: Không bắt buộc

### Query params

- `start_lng` (number, required)
- `start_lat` (number, required)
- `end_lng` (number, required)
- `end_lat` (number, required)
- `vehicle_type` (string, optional): `motorbike` | `car` | `suv` (default `motorbike`)
- `nearest_node_max_m` (int, optional, default `1200`)

### Ví dụ request

```http
GET /api/v1/routing/safe-path?start_lng=106.70098&start_lat=10.77689&end_lng=106.71792&end_lat=10.80173&vehicle_type=motorbike&nearest_node_max_m=2000
```

### Ý nghĩa response chính

- `found`: có tìm được đường an toàn hay không
- `start_node`, `end_node`: điểm map vào graph gần nhất
- `node_path`: chuỗi node id
- `route.total_cost_sec`: chi phí thời gian có phạt ngập
- `route.total_distance_m`: tổng quãng đường
- `route.segments[]`: mảng đoạn đường để FE vẽ polyline
- `avoided.blocked_edge_ids`: đoạn bị loại vì ngập quá ngưỡng xe
- `avoided.near_limit_edge_ids`: đoạn sát ngưỡng an toàn
- `flood_sources`: thông tin nguồn ngập dùng trong tính route (sensor theo bán kính + crowd reports cấu hình theo env)

### GPS / nhiều user (tránh “máy khác vẫn ra GPS máy dev”)

- Geolocation là của **trình duyệt đang mở**; nếu sai user/máy → kiểm tra **localStorage không gắn `userId`**, hard-code demo, hoặc state Provider không reset khi logout/đổi account.
- Đồng bộ server (theo JWT): `POST /api/auth/location` `{ lat, lng, accuracy_m? }` — lưu cho đúng user; `GET /api/auth/profile` trả `last_known_lat` / `last_known_lng` để prefill **user hiện tại**.
- Chi tiết: `docs/fe-integration-update-full.md` mục **7.1**.

### FE cần làm

1. Gọi API theo start/end user chọn.
2. Nếu `found=true`:
   - Vẽ route bằng `route.segments` (`from` -> `to`).
   - Hiển thị ETA từ `total_cost_sec`, khoảng cách từ `total_distance_m`.
3. Nếu `found=false`:
   - Hiển thị thông báo “Không có đường an toàn cho loại xe hiện tại”.
   - Gợi ý đổi `vehicle_type=suv` hoặc chỉnh điểm đi/đến.

Ghi chú mới:

- Routing hiện dùng cả crowd report đã duyệt gần cạnh đường (không chỉ sensor), theo env:
  - `ROUTING_CROWD_REPORT_HOURS`
  - `ROUTING_CROWD_EDGE_BUFFER_M`
  - `ROUTING_CROWD_RECENCY_HALF_LIFE_HOURS`
  - `ROUTING_CROWD_MIN_RELIABILITY`
  - `ROUTING_CROWD_MAX_BOOST`
  - `ROUTING_SENSOR_FLOOD_RADIUS_M` (mặc định 120)
  - `ROUTING_SENSOR_FLOOD_DECAY` (`linear` | `plateau`)
- Crowd report càng mới và reliability càng cao thì tác động né ngập càng mạnh.
- **Sensor:** mực nước từ `flood_logs` không còn áp “full” cho mọi edge gắn `flood_sensor_id`; chỉ còn hiệu lực trong bán kính quanh `sensors.coords` (xem `sensor_flood_radius_m`, `sensor_flood_decay` trong response). Ngoài bán kính, phần từ sensor coi như 0 (crowd/manual vẫn có thể tăng ngập).

---

## 1.2 Liên kết Telegram cá nhân

- **Method**: `POST`
- **Path**: `/api/auth/telegram/link`
- **Auth**: User JWT

Trả `deep_link` để mở bot `/start <token>`.

### Luồng FE

1. User bấm nút “Liên kết Telegram”.
2. FE gọi `POST /api/auth/telegram/link`.
3. FE mở `data.deep_link`.
4. User bấm Start bot.
5. FE gọi `GET /api/auth/telegram/status` để kiểm tra `telegram_linked=true`.

---

## 1.3 Trạng thái Telegram

- **Method**: `GET`
- **Path**: `/api/auth/telegram/status`
- **Auth**: User JWT

Response:

- `telegram_linked` (boolean)
- `telegram_username` (nullable)

---

## 1.4 Gỡ liên kết Telegram

- **Method**: `DELETE`
- **Path**: `/api/auth/telegram/unlink`
- **Auth**: User JWT

---

## 1.5 Đăng ký nhận cảnh báo theo vùng

- **Method**: `POST`
- **Path**: `/api/emergency-subscriptions`
- **Auth**: User JWT

Body:

```json
{
  "lng": 106.701,
  "lat": 10.776,
  "radius": 5000,
  "notification_methods": ["email", "telegram", "webhook"]
}
```

### API liên quan

- `GET /api/emergency-subscriptions/my-subscriptions`
- `PUT /api/emergency-subscriptions/:subscriptionId`
- `DELETE /api/emergency-subscriptions/:subscriptionId`

### FE cần làm

- Cho user chọn điểm + bán kính + kênh.
- Nếu bật `telegram` mà `telegram_linked=false`, cảnh báo user liên kết bot trước.

---

## 1.6 Heatmap + timeline

- `GET /api/heatmap`
- `GET /api/heatmap/combined`
- `GET /api/heatmap/timeline-24h`

FE map có thể bật:

- lớp trộn dữ liệu
- heatmap 24h
- biểu đồ mật độ 24h

---

## 1.7 Crowd report public (có rate limit)

- **Method**: `POST`
- **Path**: `/api/report-flood`
- **Auth**: optional

FE xử lý `429`:

- show message “Gửi quá nhanh, thử lại sau”

---

## 2) FE Admin

## 2.1 Mô phỏng ngập nhanh trên road graph (batch)

- **Method**: `PUT`
- **Path**: `/api/v1/admin/routing/manual-flood-depths/batch`
- **Auth**: Admin JWT

Body:

```json
{
  "updates": [
    { "edge_id": 101, "manual_flood_depth_cm": 40 },
    { "edge_id": 102, "manual_flood_depth_cm": 25 },
    { "edge_id": 103, "manual_flood_depth_cm": null }
  ]
}
```

Ghi chú:

- `manual_flood_depth_cm = null` => bỏ override, quay về dữ liệu sensor/flood_logs.
- Dùng cho demo “đường tránh ngập” trên FE nhanh, không cần đợi sensor thật.

### Map `flood_sensor_id` (ops / DevOps — phương án 1)

Không phải REST API: chạy trên máy hoặc job CI có `DATABASE_URL`.

```bash
npm run map:road-sensors
# khuyến nghị: xóa gán sensor cho cạnh nào không còn sensor nào trong phạm vi
npm run map:road-sensors -- --clear-out-of-range
# tuỳ chỉnh (mét), ghi đè env:
node scripts/mapRoadEdgesToSensors.js --max-distance-m 120 --clear-out-of-range
```

- Mặc định script: **150 m** nếu không set `ROUTING_EDGE_SENSOR_MAX_DISTANCE_M`; nếu chỉ có `ROUTING_SENSOR_FLOOD_RADIUS_M` thì dùng **≈ R×1.25** (clamp 50–400 m).
- Kết hợp **phương án 2** (bọng nước quanh tọa độ sensor khi tính route): map chặt (1) + suy giảm theo khoảng cách khi query (2) → ít “nhuộm ngập” cả tuyến.

---

## 2.2 Thống kê cảnh báo khẩn

- **Method**: `GET`
- **Path**: `/api/v1/admin/emergency-alerts/summary`
- **Auth**: Admin JWT
- Query: `hours` (1..168)

---

## 2.3 Sức khỏe thiết bị

- **Method**: `GET`
- **Path**: `/api/v1/admin/devices/health`
- **Auth**: Admin JWT

FE admin hiển thị:

- `online/degraded/offline/inactive`

---

## 2.4 Quản trị user

- `GET /api/auth/users`
- `POST /api/auth/users`
- `PUT /api/auth/users/:userId/role`
- `PUT /api/auth/users/:userId/active`
- `DELETE /api/auth/users/:userId`

Auth: Admin JWT

---

## 3) API hệ thống nội bộ (FE không gọi trực tiếp)

- `POST /api/v1/telegram/webhook`
  - Telegram Bot API gọi vào
  - Dùng `X-Telegram-Bot-Api-Secret-Token`
  - Không dùng JWT

---

## 4) Checklist FE triển khai nhanh

1. User routing page:
   - gọi `/api/v1/routing/safe-path`
   - render route + ETA + cảnh báo an toàn
2. User notification page:
   - Telegram link/status/unlink
   - emergency subscriptions CRUD
3. Admin simulation page:
   - batch update `manual_flood_depth_cm`
   - nút reset về `null`
   - (Ops) chạy `map:road-sensors` sau khi import graph / đổi vị trí trạm — xem mục phụ “Map `flood_sensor_id`” ngay dưới 2.1
4. Admin monitoring page:
   - emergency summary
   - devices health

---

## 5) Mã lỗi thường gặp để FE xử lý

- `400` thiếu query/body hoặc graph chưa nạp đủ
- `401` thiếu token / token hết hạn
- `403` không đủ quyền admin
- `429` rate limit report public
- `500` lỗi server/DB

---

## 6) Link tài liệu liên quan

- `docs/fe-integration-update-full.md` — **cập nhật đầy đủ cho FE** (routing sensor/crowd, HTTP/`found`, Swagger, checklist)
- `docs/report-chi-tiet-luong-moi-floodwatch.md`
- `docs/roadmap-nghiep-vu-va-huong-dan-fe.md`
- Swagger: `/api-docs`
