# Deploy production: Render + Neon

| Thành phần | Nền tảng |
|------------|----------|
| **Backend API** | [Render](https://render.com) Web Service |
| **PostgreSQL** | [Neon](https://neon.tech) (`DATABASE_URL`) |

## Render — Web Service (khuyến nghị: chỉ Node)

- **Build:** `npm ci` (hoặc Docker nếu cần Node + Python monolith).
- **Start Command:** `npm start` → `node server.js`
- **Env bắt buộc:** `DATABASE_URL` (Neon), `JWT_SECRET`, `GEMINI_API_KEY`, MQTT, CORS, `PUBLIC_BASE_URL`, …
- **Port:** Render inject `PORT` — app đã `trust proxy`.

Khi chỉ Node (không Python routing trong cùng service):

```env
SKIP_PYTHON_ROUTING=true
PYTHON_ROUTING_ENABLED=false
ROUTING_LEGACY_FALLBACK=true
```

## Neon

- Connection string: Neon Console → Connect → copy vào Render env `DATABASE_URL` (có `?sslmode=require`).
- Lần đầu: `npm run db:neon-postgis` rồi migration/seed từ máy local (cùng `DATABASE_URL`).

```bash
npm run migrate:s02-node-007
npm run migrate:road-graph
# ...
```

## Docker monolith (Node + Python, tuỳ chọn)

- Dockerfile root → `CMD node scripts/render-start.js`
- `PYTHON_ROUTING_PORT=8001` (khác `PORT` của Render)
- Cùng `DATABASE_URL` Neon cho Node và Python

## Migration / import road graph

Chạy **từ máy dev** với `DATABASE_URL` Neon (không cần CLI Render):

```bash
npm run migrate:road-graph
npm run import:road-graph -- --file ./data/roads_hcm_arterial.geojson --clear-existing
```

## Ảnh upload

Render disk mặc định **ephemeral** — gắn Persistent Disk hoặc dùng object storage nếu cần giữ ảnh lâu dài.
