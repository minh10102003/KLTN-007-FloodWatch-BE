# ---------------------------------------------------------------------------
# Chỉ dùng khi deploy SERVICE PYTHON RIÊNG trên Render (Background Worker / Web Service).
# API Node chính: Dockerfile ở GỐC repo (./Dockerfile) hoặc Render Native `npm start`.
# ---------------------------------------------------------------------------
FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY python_routing/requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

COPY python_routing/ ./

# Render inject PORT; config.py đọc PORT hoặc PYTHON_ROUTING_PORT
CMD ["python", "main.py"]
