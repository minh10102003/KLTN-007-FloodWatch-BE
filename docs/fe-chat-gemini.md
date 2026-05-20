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
    "model": "gemini-2.0-flash",
    "sensor_count": 3,
    "account_id": "user_1716…"
  }
}
```

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

## 3. Lịch sử chat (localStorage)

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

## 4. Gợi ý UI

- Chip câu hỏi nhanh: giữ nguyên, gọi cùng `sendMessage()`.
- Trước khi mở chat: có thể `GET /api/flood-status` để hiển thị 3 trạm ngập nhất.
- Hiển thị lỗi 429: *"Quá nhiều câu hỏi, thử lại sau 1 phút."*
- Hiển thị lỗi 503: *"Chat AI tạm tắt, vui lòng xem bản đồ realtime."* → fallback `GET /api/flood-data/realtime`.

---

## 5. Env FE (Vite)

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

## 6. Ops (Render / Railway)

Backend cần:

```env
GEMINI_API_KEY=…          # Google AI Studio
GEMINI_MODEL=gemini-2.0-flash   # tuỳ chọn; có thể gemini-1.5-flash
CHAT_API_MAX_PER_MINUTE=12
```

Lấy key: [Google AI Studio](https://aistudio.google.com) → Get API key.

---

## 7. So với mock HTML gốc

| Mock | Thực tế |
|------|---------|
| `fetch('/api/chat')` | `fetch(\`${VITE_API_URL}/api/chat\`)` |
| `data.reply` | Giữ nguyên khi `success: true` |
| MySQL `sensor_logs` | Postgres `flood_logs` + `sensors` |
| Port 3001 riêng | Cùng server Express hiện tại |

Swagger: `/api-docs` → tag **Chat**.
