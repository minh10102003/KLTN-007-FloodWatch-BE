# API tin RSS (ngập nước / thời tiết TP.HCM)

Endpoint public trên backend Express — client (web/mobile) gọi trực tiếp; CORS theo `CORS_ALLOWED_ORIGINS` / suffix mặc định trong `src/app.js`.

## `GET /api/news`

- **Auth:** không cần JWT (mount trong khối public, trước `apiAccess`).
- **Rate limit:** mặc định 120 request/phút/IP (tối thiểu 20); chỉnh `NEWS_API_MAX_PER_MINUTE`.
- **Cache HTTP:** header `Cache-Control: public, max-age=…` — mặc định 900 giây; chỉnh `NEWS_HTTP_CACHE_SECONDS` (60–3600).

### Response thành công (200)

```json
{
  "success": true,
  "data": [
    {
      "title": "string",
      "link": "string",
      "pubDate": "string",
      "source": "VnExpress | Tuổi Trẻ | Người Lao Động"
    }
  ]
}
```

Tối đa **15** bài, đã lọc keyword, sort theo `pubDate` giảm dần, bỏ trùng `title|link`. Một nguồn RSS lỗi thì bỏ qua nguồn đó.

### Response lỗi (500)

```json
{
  "success": false,
  "error": "Không thể tải tin tức.",
  "data": []
}
```

### Hành vi nguồn dữ liệu

- Fetch song song 3 feed: VnExpress, Tuổi Trẻ, Người Lao Động (mục thời sự).
- Timeout mỗi request: mặc định 15s; chỉnh `NEWS_RSS_TIMEOUT_MS` (5000–20000).
- Logic parse/lọc nằm trong `src/services/newsFeedService.js`.

### Gợi ý tích hợp phía client

Client gọi URL đầy đủ tới backend, ví dụ `https://<API_HOST>/api/news`, đọc mảng `data`. UI (React/Next) triển khai trong repo frontend riêng, không nằm trong repo backend này.

### Swagger

Xem nhóm tag **News** tại `/api-docs`.

### Ghi chú vận hành

RSS có điều khoản sử dụng riêng; production nên tuân thủ ToS và hiển thị nguồn rõ ràng (`source` + link bài gốc).
