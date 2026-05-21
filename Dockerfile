# Monolith (tuỳ chọn): Node.js API + Python FastAPI routing — deploy Docker trên Render.
# Render Web Service mặc định: Native Node, Start Command = npm start (không cần file này).

FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-dev \
    gcc \
    g++ \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY python_routing/requirements.txt ./python_routing/requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r python_routing/requirements.txt

ENV PATH="/opt/venv/bin:${PATH}"
ENV PYTHONUNBUFFERED=1
# Python routing; Node dùng PORT do Render inject.
ENV PYTHON_ROUTING_PORT=8001

COPY . .

EXPOSE 3000

CMD ["node", "scripts/render-start.js"]
