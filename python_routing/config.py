"""
Configuration — đọc biến môi trường từ .env (cùng file với Node.js).
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env ở thư mục cha (root project)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)


def _int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _float(key: str, default: float) -> float:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _str(key: str, default: str) -> str:
    return os.getenv(key, default)


def _bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


# ── Database ──────────────────────────────────────────────────────────────────
DB_HOST = _str("DB_HOST", "localhost")
DB_PORT = _int("DB_PORT", 5432)
DB_NAME = _str("DB_NAME", "hcm_flood_db")
DB_USER = _str("DB_USER", "postgres")
DB_PASS = _str("DB_PASS", "")

# DATABASE_URL takes precedence if set (e.g. on Railway)
DATABASE_URL = os.getenv("DATABASE_URL")

# ── Python Routing Service ────────────────────────────────────────────────────
# Railway (và nhiều PaaS) inject PORT; local dev thường dùng PYTHON_ROUTING_PORT=8001
PYTHON_ROUTING_PORT = _int("PORT", _int("PYTHON_ROUTING_PORT", 8001))
GRAPH_REFRESH_INTERVAL_SECONDS = _int("GRAPH_REFRESH_INTERVAL_SECONDS", 60)

# ── Routing parameters (same names as Node.js .env.example) ───────────────────
ROUTING_NEAREST_NODE_MAX_M = _int("ROUTING_NEAREST_NODE_MAX_M", 1200)
ROUTING_CROWD_REPORT_HOURS = _int("ROUTING_CROWD_REPORT_HOURS", 6)
ROUTING_CROWD_EDGE_BUFFER_M = _int("ROUTING_CROWD_EDGE_BUFFER_M", 35)
ROUTING_CROWD_RECENCY_HALF_LIFE_HOURS = _int("ROUTING_CROWD_RECENCY_HALF_LIFE_HOURS", 2)
ROUTING_CROWD_MIN_RELIABILITY = _int("ROUTING_CROWD_MIN_RELIABILITY", 40)
ROUTING_CROWD_MAX_BOOST = _float("ROUTING_CROWD_MAX_BOOST", 1.5)
ROUTING_SENSOR_FLOOD_RADIUS_M = _int("ROUTING_SENSOR_FLOOD_RADIUS_M", 120)
ROUTING_SENSOR_FLOOD_DECAY = _str("ROUTING_SENSOR_FLOOD_DECAY", "linear").strip().lower()
ROUTING_UTURN_PENALTY_SEC = _float("ROUTING_UTURN_PENALTY_SEC", 45.0)
ROUTING_UTURN_PENALTY_M = _float("ROUTING_UTURN_PENALTY_M", 120.0)
ROUTING_TRAFFIC_DEBUG_ENABLED = _bool("ROUTING_TRAFFIC_DEBUG_ENABLED", False)
ROUTING_TRAFFIC_DEBUG_POINTS = _str("ROUTING_TRAFFIC_DEBUG_POINTS", "")

# ── ML Model ──────────────────────────────────────────────────────────────────
ML_MODEL_PATH = _str(
    "ML_MODEL_PATH",
    str(Path(__file__).resolve().parent / "ml" / "models" / "flood_depth_model.joblib"),
)
