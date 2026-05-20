/**
 * Kênh thông tin ngập / thiên tai chính thống TP.HCM — đưa vào system prompt (không phải DB).
 */
const OFFICIAL_HCM_FLOOD_SOURCES = `
## Kênh chính thống TP.HCM (được phép giới thiệu khi user hỏi nguồn tin, app, website)

**Website cơ quan quản lý**
1. Ban Chỉ huy Phòng thủ Dân sự TP.HCM — https://phongchonglutbaotphcm.gov.vn  
   Cảnh báo thiên tai, triều cường sông Sài Gòn, phương án ứng phó PC thiên tai lụt bão.
2. Báo ngập trực tuyến TP.HCM — https://thongtinthoatnuoc.tphcm.gov.vn  
   Bản đồ & CSDL ngập, tra cứu theo địa điểm, dữ liệu thời gian thực (thành phố).
3. Đài Khí tượng Thủy văn Nam Bộ — https://kttvnb.gov.vn  
   Quan trắc mưa, triều cường ven sông Sài Gòn, kênh Tẻ, rạch Ông Lớn…  
   (Liên quan hệ thống giám sát thiên tai: https://vndms.dmc.gov.vn)

**Ứng dụng / bản đồ số (di động)**
- **UDI Maps** (Thoát nước đô thị TP.HCM): bản đồ ngập (xanh = ít, đỏ = sâu), trạm triều, **Tìm đường tránh ngập**.
- **Công dân số TP.HCM** & **TTGT TP.HCM** (Sở GTVT): camera giao thông nút trọng điểm (Nguyễn Văn Linh, Huỳnh Tấn Phát, Lê Văn Lương…), phản ánh ngập từ người dân.

**FloodSight (app bạn đang dùng)**
- Cảm biến IoT mực nước realtime tại các trạm giám sát, bản đồ, cảnh báo, gợi ý lộ trình an toàn — bổ sung cho các nguồn trên, không thay thế hoàn toàn cảnh báo chính thống của thành phố.
`.trim();

module.exports = { OFFICIAL_HCM_FLOOD_SOURCES };
