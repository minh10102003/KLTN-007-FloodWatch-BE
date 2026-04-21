# Build context: thư mục python_routing (Railway: Dockerfile path = python_routing/Dockerfile)
FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

COPY . .

# PORT do Railway inject; config.py đọc PORT
CMD ["python", "main.py"]
