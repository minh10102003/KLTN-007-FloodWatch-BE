# Phân quyền RBAC – HCM Flood Backend

Tài liệu map **role** với **route API** theo đặc tả phân quyền hệ thống. Admin **không** kế thừa quyền Moderator.

---

## 1. Nguyên tắc

- **Admin**: Hạ tầng (sensor, user, cấu hình, audit). **Không** duyệt báo cáo, không thống kê nghiệp vụ.
- **Moderator**: Kiểm duyệt báo cáo, cảnh báo, thống kê nghiệp vụ, bản đồ. **Không** quản lý sensor/user/audit.
- **User**: Báo cáo ngập, xem bản đồ, đăng ký nhận cảnh báo, profile.
- Nếu một người cần cả Admin và Moderator → gán **đồng thời 2 role** (khi backend hỗ trợ nhiều role).

---

## 2. Middleware

| Middleware | Ý nghĩa |
|------------|--------|
| `authenticate` | Đã đăng nhập (bất kỳ role). |
| `requireAdmin` | Chỉ `role === 'admin'` (hoặc `roles` chứa `'admin'`). |
| `requireModerator` | Chỉ `role === 'moderator'` (hoặc `roles` chứa `'moderator'`). Admin **không** được. |
| `optionalAuthenticate` | Có token thì set `req.user`, không thì `req.user = null`. |

---

## 3. Ma trận route theo role

### 3.1. Chỉ Admin

| Method | Route | Mô tả |
|--------|--------|--------|
| GET | `/api/audit-logs` | Xem nhật ký hệ thống |
| GET | `/api/auth/users` | Danh sách user |
| POST | `/api/auth/users` | Tạo user (cấp quyền) |
| PUT | `/api/auth/users/:userId/role` | Gán role |
| PUT | `/api/auth/users/:userId/active` | Khóa/mở khóa tài khoản |
| POST | `/api/auth/users/:userId/recompute-reliability` | Tính lại điểm tin cậy |
| POST | `/api/sensors` | Thêm trạm |
| PUT | `/api/sensors/:sensorId` | Sửa trạm |
| PUT | `/api/sensors/:sensorId/thresholds` | Cấu hình ngưỡng |
| DELETE | `/api/sensors/:sensorId` | Xóa trạm |
| POST | `/api/ota` | Tạo OTA update |
| GET | `/api/ota/pending` | Danh sách OTA pending |
| GET | `/api/stats/online-users` | Danh sách user đang online |
| GET | `/api/energy/low-battery` | Sensor pin yếu |

### 3.2. Chỉ Moderator

| Method | Route | Mô tả |
|--------|--------|--------|
| GET | `/api/reports/pending` | Báo cáo chờ duyệt |
| PUT | `/api/reports/:reportId/moderate` | Duyệt/Từ chối báo cáo |
| GET | `/api/reports/reliability-ranking` | Xếp hạng độ tin cậy |
| GET | `/api/stats/reports` | Thống kê báo cáo theo giờ/ngày |
| PUT | `/api/alerts/:alertId/acknowledge` | Xác nhận cảnh báo |
| PUT | `/api/alerts/:alertId/resolve` | Đánh dấu đã xử lý |

### 3.3. User + Moderator (đăng nhập, không phân biệt)

| Method | Route | Mô tả |
|--------|--------|--------|
| GET | `/api/alerts` | Danh sách alerts |
| GET | `/api/alerts/active` | Alerts đang active |
| GET | `/api/alerts/stats` | Thống kê alerts |
| GET | `/api/alerts/:alertId` | Chi tiết alert |
| GET | `/api/emergency-subscriptions/*` | Đăng ký/Quản lý nhận cảnh báo |
| GET | `/api/report-evaluations/:reportId` | Xem đánh giá báo cáo |
| GET | `/api/report-evaluations/:reportId/average` | Điểm TB đánh giá |

### 3.4. Chỉ User (cá nhân)

| Method | Route | Mô tả |
|--------|--------|--------|
| GET | `/api/crowd-reports/all` | Lịch sử báo cáo của mình |
| POST | `/api/report-evaluations/:reportId` | Đánh giá báo cáo (1 user 1 lần) |

### 3.5. Công khai hoặc optional auth

| Method | Route | Mô tả |
|--------|--------|--------|
| GET | `/api/flood-data/realtime`, `/api/v1/flood-data/realtime` | Dữ liệu real-time (bản đồ) |
| GET | `/api/v1/flood-data` | Flood data + sensor |
| GET | `/api/flood-history` | Lịch sử flood |
| GET | `/api/sensors/:sensorId/history` | Lịch sử theo sensor |
| GET | `/api/heatmap/*` | Heatmap |
| GET | `/api/crowd-reports` | Danh sách báo cáo (24h) |
| POST | `/api/report-flood` | Gửi báo cáo (có thể khách) |
| GET | `/api/stats/online-count` | Số user online |
| GET | `/api/stats/monthly-visits` | Lượt truy cập tháng |

### 3.6. Tài khoản cá nhân (Admin, Moderator, User)

| Method | Route | Mô tả |
|--------|--------|--------|
| PUT | `/api/auth/profile` | Cập nhật profile |
| PUT | `/api/auth/change-password` | Đổi mật khẩu |
| GET | `/api/auth/profile` | Xem profile |
| POST | `/api/auth/logout` | Đăng xuất |

---

## 4. File đã cấu hình

- **`src/middleware/auth.js`**: `requireAdmin` (chỉ admin), `requireModerator` (chỉ moderator), `hasRole()` hỗ trợ `role` hoặc `roles[]`.
- **`src/routes/auditLogRoutes.js`**: `requireAdmin`.
- **`src/routes/authRoutes.js`**: User management = `requireAdmin`.
- **`src/routes/sensorRoutes.js`**: CRUD sensor = `requireAdmin`.
- **`src/routes/reportModerationRoutes.js`**: `requireModerator`.
- **`src/routes/statsRoutes.js`**: online-users = `requireAdmin`, reports = `requireModerator`.
- **`src/routes/alertRoutes.js`**: GET = `authenticate`, acknowledge/resolve = `requireModerator`.
- **`src/routes/otaRoutes.js`**: Create/pending = `requireAdmin`.
- **`src/routes/energyRoutes.js`**: low-battery = `requireAdmin`.
- **`src/routes/crowdReportRoutes.js`**: report-flood = `optionalAuthenticate`, crowd-reports/all = `authenticate`.
