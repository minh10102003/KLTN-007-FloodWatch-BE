# Hướng dẫn FE — Chatbot cảnh báo ngập (Gemini)

Backend đã triển khai chat AI dùng **dữ liệu thật** từ PostgreSQL (`sensors` + `flood_logs`), không dùng bảng `sensor_logs` / `flood_zones` trong mock.

**Base URL:** `https://api.floodsight.id.vn` (hoặc `http://localhost:3000` khi dev).

---

## 1. API

### `POST /api/chat` (public, không bắt buộc JWT)

Gửi câu hỏi; server inject snapshot sensor vào system prompt Gemini rồi trả lời.

**Headers**

```http
Content-Type: application/json
```

**Body**

| Trường | Bắt buộc | Mô tả |
|--------|----------|--------|
| `message` | Có | Câu hỏi hiện tại (tối đa 2000 ký tự) |
| `history` | Không | Mảng lịch sử `{ role, content }` — xem mục 3 |
| `account_id` | Không | ID ẩn danh từ `localStorage` (server chỉ echo trong `meta`, **không lưu DB**) |
| `area` | Không | Lọc sensor theo `location_name` (contains, không phân biệt hoa thường) trước khi gửi AI |

**Response 200**

```json
{
  "success": true,
  "reply": "…",
  "timestamp": "2026-05-20T10:00:00.000Z",
  "meta": {
    "model": "gemini-2.5-flash",
    "sensor_count": 3,
    "intent": "general",
    "account_id": "user_1716…",
    "report_draft": null
  }
}
```

Khi user yêu cầu **tạo báo cáo ngập** (Hướng B), `meta.intent` = `"create_report"` và có thể có `report_draft`:

```json
"report_draft": {
  "ready": true,
  "intent": "create_report",
  "level": "Nặng",
  "lat": 10.798,
  "lng": 106.721,
  "location_description": "Quận 7, Nguyễn Hữu Thọ",
  "formatted_address": "Nguyễn Hữu Thọ, Quận 7, TP.HCM",
  "content": "Ngập sâu, xe không qua được",
  "missing_fields": [],
  "geocode_ok": true,
  "confirm_action": "POST /api/chat/confirm-report"
}
```

- `ready: false` + `missing_fields`: AI hỏi thêm (thiếu địa chỉ / mức ngập / geocode lỗi).
- **Chưa ghi DB** cho đến khi FE gọi confirm.

### `POST /api/chat/confirm-report` (Hướng B — sau khi user bấm Xác nhận)

**Body** (lấy từ `meta.report_draft` khi `ready: true`):

```json
{
  "level": "Nặng",
  "lat": 10.798,
  "lng": 106.721,
  "location_description": "Nguyễn Hữu Thọ, Quận 7, TP.HCM",
  "content": "Ngập sâu, xe không qua được"
}
```

- Có JWT: không cần `name`.
- Khách: thêm `name` (giống `POST /api/report-flood`).
- Dùng chung rate limit báo cáo.

**Response 200:** `success`, `message`, `data.id`, `reply` (tin bot sau khi gửi thành công).

**Lỗi thường gặp**

| HTTP | Ý nghĩa |
|------|---------|
| 400 | Tin nhắn trống / quá dài |
| 429 | Rate limit IP (~12/phút) hoặc quota Gemini |
| 502 | Lỗi gọi Gemini |
| 503 | Server chưa set `GEMINI_API_KEY` |

---

### `GET /api/flood-status` (public)

Lấy snapshot cùng định dạng đưa vào AI (widget, bảng tóm tắt, không cần gọi chat).

**Query:** `area` (optional), `limit` (optional, mặc định 50).

**Response 200**

```json
{
  "success": true,
  "data": [
    {
      "sensor_id": "S01",
      "khu_vuc": "Nguyễn Hữu Cảnh - Đoạn trũng cầu vượt",
      "muc_nuoc_cm": 12.5,
      "thoi_gian": "2026-05-20T09:55:00.000Z",
      "toa_do": { "lat": 10.812, "lng": 106.718 },
      "trang_thai": "warning",
      "muc_do_nguy_hiem": "CẢNH BÁO",
      "nhiet_do": 28.1,
      "do_am": 72
    }
  ],
  "timestamp": "…",
  "count": 1
}
```

**Mapping DB → chat**

| Prompt / JSON chat | DB thực tế |
|--------------------|------------|
| `khu_vuc` | `sensors.location_name` |
| `muc_nuoc_cm` | `flood_logs.water_level` (cm) |
| `thoi_gian` | `flood_logs.created_at` |
| `toa_do` | tọa độ `sensors.coords` |
| `trang_thai` | `normal` / `warning` / `danger` / `offline` |

---

## 2. CORS & auth

- Route nằm **khối public** (giống `/api/news`, weather): **không** cần `Authorization`.
- Nếu user đã đăng nhập, gửi Bearer vẫn được (không bắt buộc).
- Origin FE phải nằm trong CORS backend (`floodsight.id.vn`, `localhost:5173`, Capacitor, …).

---

## 3. UI gợi ý — card nháp báo cáo (Hướng B)

Khi `meta.report_draft?.ready === true`:

1. Hiển thị card: địa chỉ, mức ngập, mô tả, tọa độ.
2. Nút **Xác nhận gửi báo cáo** → `POST /api/chat/confirm-report` với body trên + `Authorization` nếu đăng nhập.
3. Nút **Sửa / Hủy** → user chat lại hoặc đóng card.
4. Sau success: hiện `#${data.id}`, trạng thái `pending`.

```javascript
async function confirmReportDraft(draft) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('access_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/chat/confirm-report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      level: draft.level,
      lat: draft.lat,
      lng: draft.lng,
      location_description: draft.formatted_address || draft.location_description,
      content: draft.content || undefined
    })
  });
  return res.json();
}
```

Ví dụ câu chat: *"Hãy tạo báo cáo ở Quận 7 đường Nguyễn Hữu Thọ, ngập nặng"*.

---

## 4. Lịch sử chat (localStorage)

Giữ logic mẫu của bạn; chỉnh **URL và xử lý response**:

```javascript
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.floodsight.id.vn';

async function sendMessage() {
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  chatHistory.push({ role: 'user', content: text });
  renderMessages();

  let data;
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: chatHistory,
        account_id: ACCOUNT_ID
      })
    });
    data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Chat thất bại');
    }
  } catch (e) {
    appendBotMessage(e.message || 'Không kết nối được server.');
    return;
  }

  chatHistory.push({ role: 'model', content: data.reply });
  saveHistory();
  renderMessages();
}
```

**Lưu ý `history`**

- Role assistant: dùng **`model`** (không dùng `assistant`) — khớp Gemini và backend.
- Backend tự bỏ tin `user` trùng ở cuối `history` khi gửi Gemini.
- Giới hạn ~20 lượt (40 message) phía server; FE nên `slice(-50)` như mẫu.

---

## 5. Gợi ý UI

- Chip câu hỏi nhanh: giữ nguyên, gọi cùng `sendMessage()`.
- Trước khi mở chat: có thể `GET /api/flood-status` để hiển thị 3 trạm ngập nhất.
- Hiển thị lỗi 429: *"Quá nhiều câu hỏi, thử lại sau 1 phút."*
- Hiển thị lỗi 503: *"Chat AI tạm tắt, vui lòng xem bản đồ realtime."* → fallback `GET /api/flood-data/realtime`.

---

## 6. Env FE (Vite)

```env
VITE_API_URL=https://api.floodsight.id.vn
```

Dev proxy (tuỳ chọn `vite.config.js`):

```javascript
proxy: {
  '/api': { target: 'http://localhost:3000', changeOrigin: true }
}
```

Khi dùng proxy, `API_BASE = ''` (relative).

---

## 7. Ops (Render + Neon)

Backend cần:

```env
GEMINI_API_KEY=…
GEMINI_MODEL=gemini-2.5-flash
CHAT_API_MAX_PER_MINUTE=12
GOOGLE_PLACES_API_KEY=…   # hoặc GOOGLE_GEOCODING_API_KEY — bắt buộc cho geocode nháp báo cáo
```

Lấy key: [Google AI Studio](https://aistudio.google.com) → Get API key.

---

## 8. So với mock HTML gốc

| Mock | Thực tế |
|------|---------|
| `fetch('/api/chat')` | `fetch(\`${VITE_API_URL}/api/chat\`)` |
| `data.reply` | Giữ nguyên khi `success: true` |
| MySQL `sensor_logs` | Postgres `flood_logs` + `sensors` |
| Port 3001 riêng | Cùng server Express hiện tại |

Swagger: `/api-docs` → tag **Chat**.
