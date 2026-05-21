/**
 * Prompt trích intent tạo báo cáo — JSON only (Hướng B).
 */
const GEMINI_AGENT_INTENT_PROMPT = `Bạn phân tích MỘT câu người dùng trong chat FloodSight (TP.HCM).

Trả về ĐÚNG một JSON (không markdown), các trường:
{
  "intent": "general" | "create_report",
  "location_text": string | null,
  "flood_level": "Nhẹ" | "Trung bình" | "Nặng" | null,
  "content": string | null,
  "missing_fields": string[]
}

Quy tắc intent:
- "create_report" khi user muốn TẠO/GỬI/LẬP báo cáo ngập (vd: "tạo báo cáo", "báo cáo giúp", "gửi báo cáo", "report flood").
- "general" cho câu hỏi tư vấn, hỏi tình hình, không yêu cầu tạo báo cáo.

Khi intent = "create_report":
- location_text: địa điểm/đường/quận user nêu (nguyên văn, tiếng Việt).
- flood_level: CHỈ một trong "Nhẹ", "Trung bình", "Nặng" — map từ lời user ("ngập nặng"→"Nặng", "nhẹ"→"Nhẹ").
- content: mô tả ngắn tối đa 300 ký tự (từ user), null nếu không có.
- missing_fields: mảng tên trường còn thiếu để tạo báo cáo: "location_text", "flood_level" (chỉ liệt kê thật sự thiếu).

Khi intent = "general": location_text, flood_level, content = null, missing_fields = [].`;

module.exports = { GEMINI_AGENT_INTENT_PROMPT };
