"""
Train flood depth prediction model (Phase 3 — placeholder).

Usage:
    python python_routing/ml/train_flood_model.py

Input: flood_logs + crowd_reports + sensors + weather (Open-Meteo historical)
Output: python_routing/ml/models/flood_depth_model.joblib

Model: GradientBoosting or RandomForest
Features:
    - sensor_water_level (nearest)
    - distance_to_nearest_sensor
    - crowd_report_count_nearby
    - avg_crowd_flood_level
    - rainfall_mm (last 1h, 3h, 6h, 24h)
    - hour_of_day, day_of_week, month
    - road_speed_limit (proxy for road class)
    - historical_flood_frequency (edge flood count)
"""
import logging
import asyncio
import os
import sys
import numpy as np
import joblib
from pathlib import Path

# Thêm đường dẫn gốc để import modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db import init_pool, close_pool, fetch_all
from ml.features import extract_features_for_edges

try:
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, mean_squared_error
except ImportError:
    print("Vui lòng cài đặt scikit-learn: pip install scikit-learn")
    sys.exit(1)

logger = logging.getLogger("train_flood_model")


async def fetch_data():
    """Fetch raw data from DB."""
    await init_pool()
    try:
        # Lấy edges (giới hạn 5000 edge để train demo)
        edges = await fetch_all('''
            SELECT id, from_node_id, to_node_id, speed_limit_mps, length_m,
                   ST_X(ST_StartPoint(geom::geometry)) as from_lng,
                   ST_Y(ST_StartPoint(geom::geometry)) as from_lat
            FROM road_edges
            LIMIT 5000
        ''')
        
        # Lấy sensors
        sensors = await fetch_all('''
            SELECT sensor_id, ST_X(coords::geometry) as lng, ST_Y(coords::geometry) as lat
            FROM sensors
        ''')
        
        # Lấy flood logs gần đây
        flood_logs = await fetch_all('''
            SELECT sensor_id, water_level 
            FROM flood_logs 
            ORDER BY created_at DESC 
            LIMIT 1000
        ''')
        
        # Lấy crowd reports gần đây
        crowd_reports = await fetch_all('''
            SELECT flood_level, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
            FROM crowd_reports
            WHERE moderation_status = 'approved'
            ORDER BY created_at DESC
            LIMIT 500
        ''')
        
        return edges, sensors, flood_logs, crowd_reports
    finally:
        await close_pool()


def generate_labels(features):
    """
    Tạo labels giả lập (Synthetic Labels) cho mục đích proof of concept.
    Trong thực tế, labels này sẽ đến từ historical deterministic outputs hoặc survey.
    
    Công thức giả lập: 
    depth = nearest_sensor_level * exp(-dist/500) + avg_crowd * 0.8
    """
    y = []
    for f in features:
        dist = f[2]
        sensor_level = f[3]
        avg_crowd = f[5]
        
        depth = sensor_level * np.exp(-dist / 500.0) + avg_crowd * 0.8
        # Thêm chút noise
        depth += np.random.normal(0, 2.0)
        y.append(max(0.0, depth))
        
    return np.array(y)


async def main_async():
    logger.info("Bắt đầu fetch data từ Database...")
    edges, sensors, flood_logs, crowd_reports = await fetch_data()
    
    logger.info(f"Đã tải {len(edges)} edges, {len(sensors)} sensors, {len(flood_logs)} flood logs, {len(crowd_reports)} crowd reports.")
    
    if len(edges) == 0:
        logger.error("Không có edges để train!")
        return

    logger.info("Bắt đầu trích xuất features...")
    X = extract_features_for_edges(edges, sensors, flood_logs, crowd_reports)
    
    logger.info("Tạo synthetic labels (Phase 3 Proof of Concept)...")
    y = generate_labels(X)
    
    # Chia train/test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    logger.info("Train RandomForest model...")
    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)
    
    # Đánh giá
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    
    logger.info(f"Model Performance trên tập test: MAE = {mae:.2f} cm, RMSE = {rmse:.2f} cm")
    
    # Lưu model
    model_dir = Path(__file__).parent / "models"
    model_dir.mkdir(exist_ok=True)
    model_path = model_dir / "flood_depth_model.joblib"
    
    joblib.dump(model, model_path)
    logger.info(f"Đã lưu model tại: {model_path}")
    logger.info("Phase 3: Hoàn tất training pipeline.")

def main():
    asyncio.run(main_async())

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
