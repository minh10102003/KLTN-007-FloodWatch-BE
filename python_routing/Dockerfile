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
