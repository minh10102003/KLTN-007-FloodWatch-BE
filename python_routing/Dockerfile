# ---------------------------------------------------------------------------
# CẢNH BÁO — KLTN-007-FloodWatch-BE (API Node + MQTT + routing)
# File này chỉ dùng khi bạn deploy MỘT SERVICE PYTHON RIÊNG (chỉ FastAPI).
# Service API chính PHẢI build bằng Dockerfile ở GỐC repo: ./Dockerfile
# (đã có railway.json ép dockerfilePath = "Dockerfile").
# Nếu Railway Build trỏ nhầm vào file này → container không có Node → api.floodsight 502.
# ---------------------------------------------------------------------------
# Railway thường dùng CONTEXT = gốc repo (có package.json), dù Dockerfile nằm trong python_routing/.
# Vì vậy mọi COPY phải tiền tố python_routing/
FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY python_routing/requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

COPY python_routing/ ./

# PORT do Railway inject; config.py đọc PORT
CMD ["python", "main.py"]
