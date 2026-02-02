# 📋 Bảng Danh Sách Nghiệp Vụ và Use Case - Hệ Thống Giám Sát Ngập Lụt HCM

## 🎯 Tổng Quan Hệ Thống

Hệ thống giám sát ngập lụt TP.HCM sử dụng:
- **IoT Sensors**: Thu thập dữ liệu mực nước real-time qua MQTT
- **Crowdsourcing**: Người dân báo cáo ngập lụt qua ứng dụng
- **Backend API**: Xử lý, lưu trữ và phân tích dữ liệu
- **Database**: PostgreSQL với PostGIS để lưu trữ dữ liệu địa lý

---

## 📊 BẢNG 1: NGHIỆP VỤ QUẢN LÝ SENSOR

| STT | Nghiệp Vụ | Mô Tả | Use Case | API Endpoint | Controller | Model |
|-----|-----------|-------|----------|--------------|------------|-------|
| 1 | **Định danh trạm đo** | Quản lý danh sách các trạm cảm biến (sensor) trong hệ thống | UC-SEN-001: Admin xem danh sách tất cả sensors | `GET /api/sensors` | `getAllSensors()` | `getAllSensors()` |
| 2 | **Xem chi tiết sensor** | Xem thông tin chi tiết một sensor cụ thể | UC-SEN-002: Admin/User xem thông tin sensor S01 | `GET /api/sensors/:sensorId` | `getSensorById()` | `getSensorById()` |
| 3 | **Số hóa vị trí** | Lưu trữ tọa độ địa lý (lat/lng) của sensor | UC-SEN-003: Admin thêm sensor mới với tọa độ | `POST /api/sensors` | `createSensor()` | `createSensor()` |
| 4 | **Cấu hình thông số vật lý** | Thiết lập thông số lắp đặt (độ cao, model, hardware) | UC-SEN-004: Admin cấu hình installation_height cho sensor | `POST /api/sensors` | `createSensor()` | `createSensor()` |
| 5 | **Cập nhật thông tin sensor** | Sửa đổi thông tin sensor (vị trí, model, trạng thái) | UC-SEN-005: Admin cập nhật vị trí sensor | `PUT /api/sensors/:sensorId` | `updateSensor()` | `updateSensor()` |
| 6 | **Kích hoạt/Vô hiệu hóa sensor** | Bật/tắt sensor trong hệ thống | UC-SEN-006: Admin vô hiệu hóa sensor không hoạt động | `PUT /api/sensors/:sensorId` | `updateSensor()` | `updateSensor()` |
| 7 | **Thiết lập ngưỡng báo động** | Cấu hình ngưỡng cảnh báo và nguy hiểm cho từng sensor | UC-SEN-007: Admin đặt warning_threshold=10cm, danger_threshold=30cm | `PUT /api/sensors/:sensorId/thresholds` | `updateThresholds()` | `updateThresholds()` |
| 8 | **Xóa sensor** | Gỡ bỏ sensor khỏi hệ thống | UC-SEN-008: Admin xóa sensor không còn sử dụng | `DELETE /api/sensors/:sensorId` | `deleteSensor()` | `deleteSensor()` |

---

## 📊 BẢNG 2: NGHIỆP VỤ GIÁM SÁT & PHÂN TÍCH REAL-TIME

| STT | Nghiệp Vụ | Mô Tả | Use Case | API Endpoint | Controller | Model | Service |
|-----|-----------|-------|----------|--------------|------------|-------|---------|
| 9 | **Thu thập dữ liệu IoT** | Nhận dữ liệu từ ESP32 qua MQTT protocol | UC-MON-001: ESP32 gửi raw_distance qua topic 'hcm/flood/data' | MQTT Topic: `hcm/flood/data` | - | - | `mqttService.init()` |
| 10 | **Lọc nhiễu dữ liệu** | Loại bỏ giá trị đột biến không hợp lý | UC-MON-002: Hệ thống loại bỏ giá trị <=0 hoặc >500cm | - | - | - | `filterNoise()` |
| 11 | **Tính toán mực nước** | Chuyển đổi raw_distance thành water_level | UC-MON-003: Tính water_level = installation_height - raw_distance | - | - | - | `mqttService` (line 148) |
| 12 | **Tính vận tốc nước dâng** | So sánh mực nước hiện tại với 5 phút trước | UC-MON-004: Tính velocity = (current - previous) / time_diff (cm/phút) | - | - | - | `calculateVelocity()` |
| 13 | **Xác định trạng thái** | Phân loại trạng thái dựa trên ngưỡng | UC-MON-005: Nếu water_level >= danger_threshold → status='danger' | - | - | - | `determineStatus()` |
| 14 | **Lưu trữ dữ liệu lịch sử** | Ghi nhận mỗi lần đo vào bảng flood_logs | UC-MON-006: Lưu raw_distance, water_level, velocity, status vào DB | - | - | - | `mqttService` (line 157-161) |
| 15 | **Health Check tự động** | Kiểm tra sensor offline (không có dữ liệu >5 phút) | UC-MON-007: Tự động đánh dấu sensor offline mỗi 1 phút | - | - | - | `checkSensorHealth()` |
| 16 | **Cập nhật trạng thái sensor** | Cập nhật last_data_time và status của sensor | UC-MON-008: Cập nhật sensor.status sau mỗi lần nhận dữ liệu | - | - | - | `updateSensorHealth()` |
| 17 | **Xem dữ liệu real-time** | Lấy dữ liệu mới nhất của tất cả sensors | UC-MON-009: Frontend hiển thị bản đồ với dữ liệu real-time | `GET /api/v1/flood-data/realtime` | `getRealTimeFloodData()` | `getRealTimeFloodData()` | - |
| 18 | **Xem dữ liệu với thông tin sensor** | Lấy dữ liệu ngập kèm thông tin sensor | UC-MON-010: Frontend hiển thị danh sách sensor với mực nước | `GET /api/v1/flood-data` | `getFloodData()` | `getFloodDataWithSensors()` | - |
| 19 | **Xem lịch sử ngập lụt** | Xem tất cả dữ liệu đã lưu (API cũ) | UC-MON-011: Admin xem toàn bộ lịch sử ngập lụt | `GET /api/flood-history` | `getFloodHistory()` | `getAllFloodLogs()` | - |
| 20 | **Xem lịch sử theo sensor** | Xem dữ liệu lịch sử của một sensor cụ thể | UC-MON-012: User xem biểu đồ mực nước của sensor S01 | `GET /api/sensors/:sensorId/history` | `getFloodHistoryBySensor()` | `getFloodHistoryBySensor()` | - |

---

## 📊 BẢNG 3: NGHIỆP VỤ TƯƠNG TÁC CỘNG ĐỒNG (CROWDSOURCING)

| STT | Nghiệp Vụ | Mô Tả | Use Case | API Endpoint | Controller | Model |
|-----|-----------|-------|----------|--------------|------------|-------|
| 21 | **Người dân báo cáo ngập** | Người dùng gửi báo cáo ngập lụt qua app | UC-CRD-001: User báo cáo "Ngập Nặng" tại vị trí (lng, lat) | `POST /api/report-flood` | `createReport()` | `createReport()` |
| 22 | **Xác minh chéo với sensor** | So sánh báo cáo với dữ liệu sensor gần nhất (500m) | UC-CRD-002: Hệ thống tìm sensor trong 500m và so sánh mức độ ngập | - | - | `crossValidateWithSensors()` |
| 23 | **Tính điểm tin cậy** | Đánh giá độ tin cậy của người báo cáo (0-100) | UC-CRD-003: Người báo cáo chính xác được +5 điểm, sai bị -10 điểm | - | - | `updateReliabilityScore()` |
| 24 | **Gán trạng thái xác minh** | Đánh dấu báo cáo đã được xác minh hay chưa | UC-CRD-004: Báo cáo khớp với sensor → validation_status='cross_verified' | - | - | `crossValidateWithSensors()` |
| 25 | **Xem báo cáo gần đây** | Lấy danh sách báo cáo trong 24h qua | UC-CRD-005: Frontend hiển thị báo cáo mới nhất trong ngày | `GET /api/crowd-reports` | `getCrowdReports()` | `getRecentReports()` |
| 26 | **Xem tất cả báo cáo** | Lấy toàn bộ báo cáo (không giới hạn thời gian) | UC-CRD-006: Admin xem tất cả báo cáo để phân tích | `GET /api/crowd-reports/all` | `getAllReports()` | `getAllReports()` |

---

## 📊 BẢNG 4: USE CASE CHI TIẾT THEO ACTOR

### 👤 ACTOR: ADMIN

| Use Case ID | Tên Use Case | Mô Tả | API Endpoint | Input | Output |
|-------------|--------------|-------|--------------|-------|--------|
| UC-ADM-001 | Quản lý danh sách sensors | Xem tất cả sensors trong hệ thống | `GET /api/sensors` | - | Danh sách sensors với thông tin đầy đủ |
| UC-ADM-002 | Thêm sensor mới | Tạo sensor mới với thông tin đầy đủ | `POST /api/sensors` | sensor_id, location_name, lng, lat, installation_height, ... | Sensor đã tạo |
| UC-ADM-003 | Cập nhật thông tin sensor | Sửa đổi thông tin sensor | `PUT /api/sensors/:sensorId` | location_name, lng, lat, is_active, ... | Sensor đã cập nhật |
| UC-ADM-004 | Cấu hình ngưỡng báo động | Đặt warning_threshold và danger_threshold | `PUT /api/sensors/:sensorId/thresholds` | warning_threshold, danger_threshold | Thresholds đã cập nhật |
| UC-ADM-005 | Xóa sensor | Gỡ bỏ sensor khỏi hệ thống | `DELETE /api/sensors/:sensorId` | sensorId | Thông báo xóa thành công |
| UC-ADM-006 | Xem lịch sử ngập lụt | Xem toàn bộ dữ liệu đã lưu | `GET /api/flood-history` | - | Danh sách flood_logs |
| UC-ADM-007 | Xem tất cả báo cáo cộng đồng | Xem toàn bộ báo cáo từ người dân | `GET /api/crowd-reports/all?limit=100` | limit (optional) | Danh sách báo cáo |

### 👤 ACTOR: END USER (Người dùng ứng dụng)

| Use Case ID | Tên Use Case | Mô Tả | API Endpoint | Input | Output |
|-------------|--------------|-------|--------------|-------|--------|
| UC-USER-001 | Xem bản đồ ngập lụt real-time | Xem trạng thái ngập lụt trên bản đồ | `GET /api/v1/flood-data/realtime` | - | Dữ liệu real-time với status, water_level, velocity |
| UC-USER-002 | Xem chi tiết sensor | Xem thông tin một sensor cụ thể | `GET /api/sensors/:sensorId` | sensorId | Thông tin sensor |
| UC-USER-003 | Xem lịch sử sensor | Xem biểu đồ mực nước của sensor | `GET /api/sensors/:sensorId/history?limit=100` | sensorId, limit | Lịch sử flood_logs |
| UC-USER-004 | Báo cáo ngập lụt | Gửi báo cáo ngập lụt từ vị trí hiện tại | `POST /api/report-flood` | name, level, lng, lat, reporter_id | Báo cáo đã tạo với validation_status |
| UC-USER-005 | Xem báo cáo gần đây | Xem các báo cáo trong 24h qua | `GET /api/crowd-reports` | - | Danh sách báo cáo 24h |

### 🤖 ACTOR: IOT DEVICE (ESP32/Sensor)

| Use Case ID | Tên Use Case | Mô Tả | MQTT Topic | Input | Output |
|-------------|--------------|-------|------------|-------|--------|
| UC-IOT-001 | Gửi dữ liệu đo | ESP32 gửi raw_distance qua MQTT | `hcm/flood/data` | JSON: {sensor_id, value} | Dữ liệu được xử lý và lưu vào DB |
| UC-IOT-002 | Nhận xử lý tự động | Hệ thống tự động tính toán và lưu trữ | - | raw_distance | water_level, velocity, status được lưu |

---

## 📊 BẢNG 5: QUY TRÌNH XỬ LÝ DỮ LIỆU MQTT

| Bước | Nghiệp Vụ | Mô Tả | Function/Service |
|------|-----------|-------|-----------------|
| 1 | **Nhận dữ liệu MQTT** | Subscribe topic 'hcm/flood/data' và nhận message | `mqttService.init()` → `client.on('message')` |
| 2 | **Parse JSON** | Chuyển đổi message thành object | `JSON.parse(message.toString())` |
| 3 | **Lọc nhiễu** | Loại bỏ giá trị không hợp lý (<=0 hoặc >500cm) | `filterNoise(rawDistance)` |
| 4 | **Lấy thông tin sensor** | Query installation_height từ bảng sensors | `pool.query(SELECT installation_height...)` |
| 5 | **Tính mực nước** | water_level = installation_height - raw_distance | `Math.max(0, installationHeight - filteredDistance)` |
| 6 | **Tính vận tốc** | So sánh với dữ liệu 5 phút trước | `calculateVelocity(sensorId, waterLevel)` |
| 7 | **Xác định trạng thái** | Dựa trên warning_threshold và danger_threshold | `determineStatus(sensorId, waterLevel)` |
| 8 | **Lưu vào flood_logs** | INSERT vào bảng flood_logs | `INSERT INTO flood_logs(...)` |
| 9 | **Cập nhật sensor health** | Cập nhật last_data_time và status | `updateSensorHealth(sensorId, status)` |
| 10 | **Health check định kỳ** | Kiểm tra sensor offline mỗi 1 phút | `setInterval(checkSensorHealth, 60000)` |

---

## 📊 BẢNG 6: QUY TRÌNH XÁC MINH BÁO CÁO CỘNG ĐỒNG

| Bước | Nghiệp Vụ | Mô Tả | Function/Model |
|------|-----------|-------|----------------|
| 1 | **Nhận báo cáo** | User gửi POST request với name, level, lng, lat | `crowdReportController.createReport()` |
| 2 | **Validate input** | Kiểm tra các trường bắt buộc và flood_level hợp lệ | `crowdReportController.createReport()` |
| 3 | **Tìm sensor gần nhất** | Tìm sensor trong bán kính 500m | `crossValidateWithSensors(lng, lat, floodLevel)` |
| 4 | **So sánh mức độ ngập** | Chuyển đổi flood_level sang cm và so sánh | `levelMap`: Nhẹ=10cm, Trung bình=30cm, Nặng=50cm |
| 5 | **Xác minh chéo** | Nếu sensor báo ngập VÀ user báo ngập → verified | `crossValidateWithSensors()` → `verified: true` |
| 6 | **Lấy điểm tin cậy** | Tính điểm trung bình của reporter_id | `getAllReports()` → `AVG(reliability_score)` |
| 7 | **Tạo báo cáo** | INSERT vào bảng crowd_reports | `crowdReportModel.createReport()` |
| 8 | **Cập nhật điểm tin cậy** | Nếu verified → +5 điểm, sai → -10 điểm | `updateReliabilityScore(reporterId, isAccurate)` |
| 9 | **Trả kết quả** | Thông báo validation_status và verified_by_sensor | Response JSON với message |

---

## 📊 BẢNG 7: TRẠNG THÁI VÀ NGƯỠNG BÁO ĐỘNG

| Trạng Thái | Mô Tả | Điều Kiện | Màu Sắc (Frontend) |
|------------|-------|-----------|-------------------|
| **normal** | Bình thường | water_level < warning_threshold | 🟢 Xanh lá |
| **warning** | Cảnh báo | warning_threshold <= water_level < danger_threshold | 🟡 Vàng |
| **danger** | Nguy hiểm | water_level >= danger_threshold | 🔴 Đỏ |
| **offline** | Sensor không hoạt động | Không có dữ liệu > 5 phút | ⚫ Xám |

| Ngưỡng | Giá Trị Mặc Định | Mô Tả | Có Thể Tùy Chỉnh |
|--------|------------------|-------|------------------|
| **warning_threshold** | 10 cm | Mức cảnh báo (đến mắt cá) | ✅ Có (qua API) |
| **danger_threshold** | 30 cm | Mức nguy hiểm (đến đầu gối) | ✅ Có (qua API) |

---

## 📊 BẢNG 8: CẤU TRÚC DỮ LIỆU CHÍNH

### Bảng `sensors`
- **Nghiệp vụ**: Định danh trạm đo, Số hóa vị trí, Cấu hình thông số vật lý
- **Trường chính**: sensor_id, location_name, coords (PostGIS), installation_height, status, last_data_time

### Bảng `sensor_thresholds`
- **Nghiệp vụ**: Thiết lập ngưỡng báo động động
- **Trường chính**: sensor_id, warning_threshold, danger_threshold, updated_by

### Bảng `flood_logs`
- **Nghiệp vụ**: Giám sát & Phân tích Real-time
- **Trường chính**: sensor_id, raw_distance, water_level, velocity, status, created_at

### Bảng `crowd_reports`
- **Nghiệp vụ**: Tương tác Cộng đồng (Crowdsourcing)
- **Trường chính**: reporter_name, reporter_id, flood_level, location (PostGIS), reliability_score, validation_status, verified_by_sensor

---

## 📊 BẢNG 9: API ENDPOINTS TỔNG HỢP

| Method | Endpoint | Nghiệp Vụ | Use Case |
|--------|----------|-----------|----------|
| GET | `/api/sensors` | Lấy danh sách sensors | UC-ADM-001, UC-USER-001 |
| GET | `/api/sensors/:sensorId` | Xem chi tiết sensor | UC-ADM-002, UC-USER-002 |
| POST | `/api/sensors` | Tạo sensor mới | UC-ADM-002 |
| PUT | `/api/sensors/:sensorId` | Cập nhật sensor | UC-ADM-003 |
| PUT | `/api/sensors/:sensorId/thresholds` | Cập nhật ngưỡng | UC-ADM-004 |
| DELETE | `/api/sensors/:sensorId` | Xóa sensor | UC-ADM-005 |
| GET | `/api/v1/flood-data/realtime` | Dữ liệu real-time | UC-USER-001 ⭐ |
| GET | `/api/v1/flood-data` | Dữ liệu với sensor info | UC-MON-010 |
| GET | `/api/flood-history` | Lịch sử ngập lụt | UC-ADM-006 |
| GET | `/api/sensors/:sensorId/history` | Lịch sử theo sensor | UC-USER-003 |
| POST | `/api/report-flood` | Báo cáo ngập lụt | UC-USER-004 |
| GET | `/api/crowd-reports` | Báo cáo 24h | UC-USER-005 |
| GET | `/api/crowd-reports/all` | Tất cả báo cáo | UC-ADM-007 |

---

## 📝 GHI CHÚ

1. **MQTT Service**: Chạy tự động khi server khởi động, không có API endpoint
2. **Health Check**: Tự động chạy mỗi 1 phút để đánh dấu sensor offline
3. **PostGIS**: Sử dụng để lưu trữ và truy vấn dữ liệu địa lý (coords, location)
4. **Validation**: Báo cáo cộng đồng được xác minh tự động với sensor trong 500m
5. **Reliability Score**: Điểm tin cậy từ 0-100, bắt đầu từ 50, tăng/giảm dựa trên độ chính xác

---

**Tài liệu được tạo tự động dựa trên phân tích code hiện tại**  
**Ngày tạo**: 2026-01-27  
**Version**: 1.0


