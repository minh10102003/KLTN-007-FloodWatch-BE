import logging
import math
import numpy as np

logger = logging.getLogger("features")


def extract_features_for_edges(edges, sensors, flood_logs, crowd_reports):
    """
    Extract ML features for a list of edges given the current snapshot of data.
    
    Returns a numpy array of shape (n_edges, n_features)
    Features:
    0: speed_limit_mps (proxy for road class)
    1: length_m
    2: distance_to_nearest_sensor_m
    3: nearest_sensor_water_level_cm
    4: crowd_reports_count_within_1km
    5: avg_crowd_flood_level
    """
    features = []
    
    # 1. Index sensors and their latest water levels
    sensor_data = {}
    for log in flood_logs:
        sid = log['sensor_id']
        # keep the most recent or max level
        if sid not in sensor_data or log['water_level'] > sensor_data[sid]:
            sensor_data[sid] = log['water_level']
            
    sensor_coords = {s['sensor_id']: (s['lng'], s['lat']) for s in sensors}
    
    # 2. Extract features per edge
    for e in edges:
        speed = e.get('speed_limit_mps', 8.33)
        length = e.get('length_m', 100)
        
        # Edge center approx (using from_node pos)
        lng = e.get('from_lng', 106.7)
        lat = e.get('from_lat', 10.8)
        
        # Nearest sensor
        min_dist = float('inf')
        nearest_level = 0.0
        for sid, (slng, slat) in sensor_coords.items():
            # Haversine approx
            dist = haversine(lng, lat, slng, slat)
            if dist < min_dist:
                min_dist = dist
                nearest_level = sensor_data.get(sid, 0.0)
                
        # Crowd reports
        crowd_count = 0
        crowd_sum = 0.0
        for r in crowd_reports:
            rlng, rlat = r['lng'], r['lat']
            dist = haversine(lng, lat, rlng, rlat)
            if dist <= 1000:
                crowd_count += 1
                level_str = r.get('flood_level', 'Ngập nhẹ')
                crowd_sum += parse_crowd_level(level_str)
                
        avg_crowd = crowd_sum / crowd_count if crowd_count > 0 else 0.0
        
        features.append([
            speed,
            length,
            min_dist,
            nearest_level,
            crowd_count,
            avg_crowd
        ])
        
    return np.array(features)

def haversine(lng1, lat1, lng2, lat2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def parse_crowd_level(level_str):
    l = str(level_str).lower()
    if 'nặng' in l or 'cao' in l: return 40.0
    if 'vừa' in l or 'trung bình' in l: return 20.0
    if 'nhẹ' in l or 'thấp' in l: return 10.0
    return 0.0
