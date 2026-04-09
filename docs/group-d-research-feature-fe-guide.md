# Nhóm D - Tài liệu FE cho chức năng Research (D1 + D2)

Tài liệu này mô tả chi tiết cách FE triển khai chức năng mới của Nhóm D:
- **D1:** Đánh giá định lượng (MAE/RMSE/Bias) giữa `crowd_only` và `fused`.
- **D2:** Phân tích cold-start hotspot (vùng có report mạnh nhưng xa sensor).

Mục tiêu là giúp FE biết chính xác:
1) FE nào cần tính năng này,  
2) Mỗi FE hiển thị gì,  
3) Gọi API nào và xử lý response ra sao.

---

## 1) Tóm tắt nhanh chức năng backend

### API 1 - D1 Evaluation
- `GET /api/v1/research/evaluation`
- Dùng để trả số liệu đánh giá định lượng:
  - `sample_count`
  - `baseline_crowd_only`: `mae_cm`, `rmse_cm`, `bias_cm`
  - `fused_model`: `mae_cm`, `rmse_cm`, `bias_cm`

### API 2 - D2 Cold-start Hotspots
- `GET /api/v1/research/cold-start-hotspots`
- Dùng để trả các hotspot thiếu cảm biến:
  - `hotspot_lng`, `hotspot_lat`
  - `report_count`
  - `avg_crowd_cm`, `max_crowd_cm`
  - `nearest_sensor_min_dist_m`
  - `latest_report_at`

---

## 2) FE nào cần chức năng này hơn?

## Kết luận
- **FE Admin cần chính** (bắt buộc).
- **FE User chỉ cần gián tiếp**, không cần lộ toàn bộ metric nghiên cứu.

### Vì sao FE Admin cần chính?
- D1/D2 phục vụ phân tích chất lượng hệ thống và quyết định vận hành.
- Dùng để làm báo cáo luận văn, dashboard nội bộ, đề xuất mở rộng sensor.

### FE User cần gì?
- User chỉ cần kết quả cuối (cảnh báo/map dễ hiểu), không cần MAE/RMSE/Bias.
- Có thể hiển thị nhẹ 1 nhãn "khu vực thiếu cảm biến" nếu cần truyền thông minh bạch.

---

## 3) Đề xuất UI/UX cho FE Admin

Tạo một trang mới: **Research Analytics** (trong admin sidebar).

### 3.1. Khu bộ lọc (Filter Bar)
- `Time range`:
  - D1: `crowd_hours`, `sensor_hours`
  - D2: `report_hours`
- `No-sensor radius (m)` cho D2 (`no_sensor_radius_m`)
- `Min reports` cho D2 (`min_reports`)
- `BBox filter` (sync theo map viewport hoặc nhập thủ công)
- Nút:
  - `Áp dụng`
  - `Reset`
  - `Xuất CSV` (tuỳ chọn)

### 3.2. Khu D1 - Evaluation cards + so sánh
- 3 nhóm metric chính (mỗi nhóm 2 giá trị baseline/fused):
  1. MAE
  2. RMSE
  3. Bias
- Hiển thị thêm:
  - `sample_count`
  - `% cải thiện` (ví dụ giảm RMSE)
- Màu gợi ý:
  - Xanh khi fused tốt hơn baseline
  - Cam/đỏ khi không cải thiện

### 3.3. Khu D2 - Hotspots map + table
- **Map layer**:
  - Marker/circle theo `hotspot_lng/hotspot_lat`
  - Radius marker tỉ lệ theo `report_count`
  - Màu theo `avg_crowd_cm`
- **Table ranking**:
  - Cột: `#`, `tọa độ`, `report_count`, `avg_cm`, `max_cm`, `nearest_sensor_min_dist_m`, `latest_report_at`
  - Sort mặc định: `report_count DESC`
- Click row:
  - zoom map đến hotspot
  - mở drawer chi tiết

### 3.4. Empty/Error states
- Nếu `sample_count = 0` hoặc `data=[]`:
  - Hiển thị “Chưa đủ dữ liệu trong khoảng thời gian đã chọn”.
- Nếu lỗi API:
  - Toast + nút retry.

---

## 4) Đề xuất hiển thị cho FE User (nếu muốn dùng một phần)

Không hiển thị bảng metric nghiên cứu.

Chỉ cân nhắc:
- Một lớp map nhẹ: “Khu vực dữ liệu cộng đồng nhiều (đang thiếu cảm biến)”.
- Tooltip đơn giản:
  - “Nhiều báo cáo từ người dân, hệ thống đề xuất bổ sung cảm biến”.

Không hiển thị MAE/RMSE/Bias cho user app để tránh rối.

---

## 5) Hợp đồng API cho FE

### 5.1. D1 - `/api/v1/research/evaluation`

#### Query params
- `crowd_hours` (int, mặc định 72)
- `sensor_hours` (int, mặc định 6)
- `min_lng`, `max_lng`, `min_lat`, `max_lat` (optional, đi theo cặp bbox)

#### Response mẫu rút gọn
```json
{
  "success": true,
  "meta": {
    "crowd_report_hours": 72,
    "sensor_log_hours": 6
  },
  "data": {
    "sample_count": 128,
    "baseline_crowd_only": { "count": 128, "mae_cm": 12.4, "rmse_cm": 16.8, "bias_cm": 2.1 },
    "fused_model": { "count": 128, "mae_cm": 8.9, "rmse_cm": 12.2, "bias_cm": 0.7 }
  }
}
```

### 5.2. D2 - `/api/v1/research/cold-start-hotspots`

#### Query params
- `report_hours` (int, mặc định 72)
- `no_sensor_radius_m` (int, mặc định 1500)
- `min_reports` (int, mặc định 2)
- `min_lng`, `max_lng`, `min_lat`, `max_lat` (optional)

#### Response mẫu rút gọn
```json
{
  "success": true,
  "meta": {
    "report_hours": 72,
    "no_sensor_radius_m": 1500,
    "min_reports_per_hotspot": 2
  },
  "data": [
    {
      "hotspot_lng": 106.712,
      "hotspot_lat": 10.806,
      "report_count": 6,
      "avg_crowd_cm": 31.67,
      "max_crowd_cm": 50,
      "nearest_sensor_min_dist_m": 1832.4,
      "latest_report_at": "2026-04-09T02:00:00.000Z"
    }
  ]
}
```

---

## 6) Logic FE nên áp dụng

### Tính improvement cho D1
- `improvement_rmse_pct = ((baseline_rmse - fused_rmse) / baseline_rmse) * 100`
- Tương tự cho MAE.
- Nếu baseline = 0 thì gán null để tránh chia 0.

### Mapping mức ưu tiên hotspot (D2)
- Gợi ý score:
  - `priority_score = report_count * avg_crowd_cm`
- Mức:
  - Cao: top 20%
  - Trung bình: 20-60%
  - Thấp: còn lại

---

## 7) Phân quyền và bảo mật (khuyến nghị)

- Nên giới hạn 2 endpoint research cho **Admin/Moderator**.
- FE Admin:
  - render đầy đủ dashboard.
- FE User:
  - không gọi trực tiếp endpoint research.

---

## 8) Kế hoạch triển khai FE theo sprint

### Sprint 1 (nhanh để demo)
- Trang Admin Research:
  - Filter bar cơ bản
  - D1 cards
  - D2 table

### Sprint 2
- Thêm bản đồ hotspot + click sync table
- Thêm export CSV

### Sprint 3
- Tinh chỉnh UX, loading skeleton, error handling đầy đủ
- Chuẩn hóa screenshot/charts cho slide bảo vệ

---

## 9) Checklist FE bàn giao

- [ ] Có trang Admin Research riêng.
- [ ] Gọi được cả 2 API D1/D2 theo filter.
- [ ] Hiển thị đầy đủ MAE/RMSE/Bias baseline vs fused.
- [ ] Hiển thị danh sách hotspot và map layer cơ bản.
- [ ] Có empty/error/retry states.
- [ ] Có logic improvement % và highlight rõ kết quả.
- [ ] Chuẩn bị 2-3 ảnh chụp màn hình cho phần báo cáo.

