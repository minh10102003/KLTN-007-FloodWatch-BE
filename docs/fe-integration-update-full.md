# Bản cập nhật tích hợp FE — Routing (sensor + crowd), thông báo, test & lỗi

Tài liệu này tổng hợp **toàn bộ thay đổi backend liên quan FE** (khoảng 2026): AMC-A* routing, nguồn ngập (sensor theo khoảng cách + crowd), Telegram cá nhân, đăng ký cảnh báo, admin mô phỏng. Dùng để **đồng bộ team FE** với API và hành vi mong đợi.

**Base URL**

- Production: `https://api.floodsight.id.vn`
- Local: `http://localhost:3000`

**Tài liệu chi tiết API (copy nhanh path/method)**

- `docs/api-doc-fe-user-admin-routing-notify.md` — bảng endpoint User/Admin, ví dụ body.
- Báo cáo kỹ thuật tổng: `docs/report-chi-tiet-luong-moi-floodwatch.md`
- Swagger UI: `{BASE}/api-docs` — chọn server **`/`** khi mở Swagger trên cùng domain production.

---

## 1. Changelog tóm tắt (FE cần biết)

| Hạng mục | Thay đổi | Ảnh hưởng FE |
|----------|-----------|--------------|
| **Routing** | `GET /api/v1/routing/safe-path` — AMC-A*, phạt ngập theo loại xe | Trang tìm đường: query + parse response mới |
| **Nguồn ngập sensor** | Không còn “full water” cho mọi edge gắn `flood_sensor_id`; chỉ trong bán kính quanh tọa độ trạm + `linear`/`plateau` | `flood_depth_cm` trên từng segment; route ít bị “nhuộm đỏ” cả vùng |
| **Crowd** | Báo cáo `approved` trong cửa sổ thời gian, buffer mét, decay theo tuổi + reliability | Đoạn gần crowd có thể tăng ngập dù xa sensor |
| **Dữ liệu gắn sensor (ops)** | Script map mặc định chặt (~150 m), `--clear-out-of-range` | Phần lớn edge **không** có `flood_sensor_id`; chỉ cạnh rất gần trạm mới gắn — FE **không** gọi script; chỉ hiểu kết quả route |
| **Profile user** | Không trả `telegram_chat_id`; có `telegram_linked`, `telegram_username` | Màn hồ sơ / cài đặt thông báo |
| **Telegram** | `POST/GET/DELETE` link/status/unlink (JWT user) | Luồng liên kết bot cá nhân |
| **Cảnh báo** | Subscription vùng + đa kênh (`email`, `telegram`, `webhook`) | Form đăng ký; kiểm tra `telegram_linked` nếu chọn Telegram |
| **Admin** | `PUT .../manual-flood-depths/batch` mô phỏng `manual_flood_depth_cm` | Trang demo / lab (JWT admin) |

---

## 2. Routing — `GET /api/v1/routing/safe-path`

### 2.1 Request (User, không JWT)

| Query | Bắt buộc | Ghi chú |
|-------|----------|---------|
| `start_lng`, `start_lat`, `end_lng`, `end_lat` | Có | Số thực WGS84 (HCM ~ lng 106.x, lat 10.x) |
| `vehicle_type` | Không | `motorbike` \| `car` \| `suv` — default `motorbike` |
| `nearest_node_max_m` | Không | Default **1200**, clamp server **150–5000** — khoảng snap start/end vào `road_nodes` |

Ví dụ:

`GET /api/v1/routing/safe-path?start_lng=106.70098&start_lat=10.77689&end_lng=106.71792&end_lat=10.80173&vehicle_type=motorbike&nearest_node_max_m=1200`

### 2.2 Response envelope

Luôn (khi không lỗi validation):

```json
{ "success": true, "data": { ... } }
```

HTTP **200** — kể cả khi **không có đường an toàn** (xem `data.found`).

### 2.3 `data.found` — FE **phải** phân nhánh

| `data.found` | Ý nghĩa | UI gợi ý |
|--------------|---------|----------|
| `true` | Có lộ trình | Vẽ polyline từ `route.segments[]` (`from` → `to`), hiện ETA (`route.total_cost_sec`), quãng đường (`route.total_distance_m`) |
| `false` | **Không lỗi API** — không còn đường thỏa ngưỡng xe | Thông báo + gợi ý đổi `vehicle_type` (vd SUV) hoặc đổi điểm đi/đến; có thể hiện `data.reason` |

### 2.4 Các trường quan trọng trong `data`

- `vehicle` — profile đã dùng (kèm `maxWadingDepthCm` nếu BE trả).
- `start_node`, `end_node` — `{ id, lng, lat, distance_m }` node graph gần nhất.
- `node_path` — mảng id node (debug / animation).
- `route.total_cost_sec`, `route.total_distance_m`, `route.segments[]`:
  - `edge_id`, `from_node_id`, `to_node_id`, `length_m`, `speed_limit_mps`, **`flood_depth_cm`**, `from`/`to` `{ lng, lat }`.
- `avoided.blocked_edge_ids`, `avoided.near_limit_edge_ids` — cạnh bị loại khi tìm đường / cạnh sát ngưỡng (tô màu cảnh báo).
- **`flood_sources`** — object **chỉ để hiển thị debug / tooltip** (mirror env server), ví dụ:

```json
"flood_sources": {
  "crowd_report_hours": 6,
  "crowd_edge_buffer_m": 35,
  "crowd_recency_half_life_hours": 2,
  "crowd_min_reliability": 40,
  "crowd_max_boost": 1.5,
  "sensor_flood_radius_m": 120,
  "sensor_flood_decay": "linear"
}
```

FE **không** gửi các key này lên API; chỉ đọc từ response nếu cần (màn “Advanced / Debug”).

### 2.5 Logic nguồn ngập (để team hiểu UI)

Trên mỗi **edge** (trừ khi có `manual_flood_depth_cm` từ admin — ưu tiên tuyệt đối):

1. **Sensor:** lấy `water_level` mới nhất từ `flood_logs` của `flood_sensor_id` **chỉ khi** geometry cạnh nằm trong “bọng” quanh `sensors.coords` — ngoài bán kính → phần sensor = 0. Trong bán kính: `decay=linear` suy giảm theo khoảng cách, `plateau` = đủ mức trong bán kính.
2. **Crowd:** báo cáo `approved`, trong cửa sổ giờ, đủ `reliability`, buffer mét quanh điểm report; có trọng số theo độ mới.
3. **Gộp:** `max(sensor_effective, crowd_effective)` (sau đó A* dùng ngưỡng xe).

Hệ quả UI: đoạn **xa trạm** có thể có `flood_depth_cm = 0` dù vẫn có `flood_sensor_id` trên DB (edge vừa nằm trong map chặt); đoạn gần crowd có thể cao dù xa sensor.

---

## 3. Mã HTTP & lỗi routing (để FE map đúng)

| HTTP | `success` | Khi nào |
|------|-----------|---------|
| **200** | `true` | Query hợp lệ; `data.found` có thể `true` hoặc `false` |
| **400** | `false` | Thiếu/sai `start_*` / `end_*`; hoặc lỗi “không tìm thấy node”, “chưa có road_edges”, “start/end không trong đồ thị” (message tiếng Việt từ BE) |
| **500** | `false` | Lỗi khác (vd `vehicle_type` sai hiện tại trả 500 — nên hiện “tham số không hợp lệ”; có thể sửa BE sau thành 400) |

**Swagger:** chọn server **`/`** khi đang mở `{BASE}/api-docs` để **Try it out** không trỏ nhầm `localhost`.

---

## 4. Telegram & user profile (User JWT)

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/auth/telegram/link` | Trả `deep_link` mở bot |
| GET | `/api/auth/telegram/status` | `telegram_linked`, `telegram_username` |
| DELETE | `/api/auth/telegram/unlink` | Gỡ liên kết |

**Profile** (`GET /api/auth/profile` / `PUT /api/auth/profile/edit`): không expose `telegram_chat_id`; dùng `telegram_linked` để bật/tắt kênh Telegram trong subscription.

---

## 5. Đăng ký cảnh báo khẩn (User JWT)

- `POST /api/emergency-subscriptions` — body: `lng`, `lat`, `radius`, `notification_methods[]`.
- CRUD: `.../my-subscriptions`, `PUT .../:id`, `DELETE .../:id`.

FE: nếu user chọn `telegram` trong `notification_methods` mà `telegram_linked === false` → cảnh báo + dẫn tới màn liên kết bot.

---

## 6. Admin — mô phỏng ngập trên graph

- `PUT /api/v1/admin/routing/manual-flood-depths/batch` — JWT **admin**, body `{ "updates": [ { "edge_id", "manual_flood_depth_cm" | null } ] }`.
- `null` = bỏ override, quay về sensor + crowd theo query routing.

Dùng để demo trên FE: sau batch, gọi lại `safe-path` và so sánh polyline / `found`.

---

## 7. Ops (không phải API FE) — map `flood_sensor_id`

Chạy bởi DevOps trong mạng Railway (vd `railway ssh`) hoặc máy có DB public:

`npm run map:road-sensors -- --clear-out-of-range`

Sau khi map chặt, số edge có `flood_sensor_id` có thể **rất nhỏ** — đó là chủ đích; routing vẫn dùng crowd + bọng sensor. FE **không** cần gọi lệnh này.

---

## 7.1 GPS, Geolocation và nhiều user / nhiều máy (bắt buộc đọc cho FE)

**Geolocation của trình duyệt** (`navigator.geolocation`) **luôn** là vị trí **máy + trình duyệt đang mở trang** (sau khi user cho phép). Backend **không** “lấy GPS máy dev” — nếu máy khác vẫn ra đúng tọa độ máy bạn, gần như chắc FE đang dùng **dữ liệu cứng / cache sai**.

### Backend đã hỗ trợ theo user

- **`POST /api/auth/location`** (JWT): body `{ lat, lng, accuracy_m? }` — lưu `last_known_*` cho **đúng `req.user.id`** (xem `authController.updateMyLocation`).
- **`GET /api/auth/profile`** (hoặc endpoint profile user đang dùng): trả `last_known_lat`, `last_known_lng`, `last_location_at`, … cho **user của token hiện tại**.

### Quy tắc FE (tránh lẫn user / lẫn máy)

1. **Không** lưu điểm đi/đến routing trong `localStorage` / `sessionStorage` với key **chung** (vd `routingStart`) — phải gắn **`userId`** hoặc **session** (vd `routing:start:${userId}`), hoặc **không persist** tọa độ routing.
2. **`logout` / đổi tài khoản`:** xóa toàn bộ state + storage liên quan map/routing (điểm đi, điểm đến, “my location” cache).
3. **`login` thành công`:** không khôi phục tọa độ từ storage của user khác; có thể **optional** lấy điểm xuất phát từ `GET profile` → `last_known_*` của **user mới** (nếu có), hoặc để trống đến khi user bấm “Dùng vị trí tôi”.
4. **Nút “Dùng vị trí tôi”:** chỉ gọi `navigator.geolocation.getCurrentPosition` **tại thời điểm bấm**, gán vào state **phiên hiện tại**; sau đó nên gọi **`POST /api/auth/location`** để lần sau (cùng user, máy khác) có thể prefill từ server nếu product cần.
5. **Không** hard-code lat/lng demo trong `RoutingPage` / `api.js` (build production vẫn mang theo số đó → mọi máy đều “cùng GPS”).
6. **Nhiều tab / nhiều user:** mỗi tab có JS context riêng; lỗi “user A thấy GPS user B” thường do **cùng tài khoản** + **shared storage**, hoặc **Provider** giữ state cũ — reset state khi `access_token` / `user.id` đổi.

### Gợi ý debug nhanh

- DevTools → Application → Local Storage: tìm key chứa `lat`, `lng`, `routing`, `location`.
- Toàn repo FE: tìm `106.665`, `10.971`, `localStorage`, `DEFAULT_`, `initial`.

---

## 8. Checklist triển khai FE

1. **Routing + GPS:** gọi `safe-path` với start/end **đang chọn trên map hoặc Geolocation vừa lấy**; không dùng cache chung giữa user; logout/login reset; tuỳ chọn `POST /api/auth/location` + hydrate `last_known_*` từ profile — xem mục **7.1**.
2. **Routing:** xử lý `found` true/false (HTTP 200), vẽ segments, màu theo `near_limit` / độ sâu nếu product yêu cầu.
3. **Debug (tuỳ):** hiển thị `flood_sources` ở chế độ dev.
4. **Telegram:** flow link → status; subscription kiểm tra linked.
5. **Admin (nếu có quyền):** batch manual flood + reset null.
6. **Báo cáo public:** `POST /api/report-flood` — xử lý **429**.

---

## 9. Biến môi trường (tham chiếu — set trên server, không phải input FE)

| Biến | Vai trò (routing) |
|------|-------------------|
| `ROUTING_NEAREST_NODE_MAX_M` | Snap start/end (default 1200) |
| `ROUTING_SENSOR_FLOOD_RADIUS_M` | Bán kính bọng nước quanh trạm (m) |
| `ROUTING_SENSOR_FLOOD_DECAY` | `linear` \| `plateau` |
| `ROUTING_CROWD_*` | Cửa sổ giờ, buffer m, half-life, min reliability, max boost |
| `ROUTING_EDGE_SENSOR_MAX_DISTANCE_M` | Script `map:road-sensors` (mặc định script ~150 nếu không set) |

Chi tiết: `.env.example`.

---

*Tài liệu này bổ sung cho `docs/api-doc-fe-user-admin-routing-notify.md`; khi có thay đổi API, cập nhật cả hai file hoặc ghi rõ PR trong commit.*
