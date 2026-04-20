"""
Routing API endpoint — GET /api/v1/routing/safe-path

Returns the same JSON contract as the Node.js routingService.js
so the frontend doesn't need any changes.
"""
from __future__ import annotations

import math
import logging
from fastapi import APIRouter, Query, HTTPException

from services.graph_loader import graph_cache, NodePos
from services.flood_penalty import parse_vehicle_type, VEHICLE_PROFILES
from services.astar import find_path
from services.path_smoother import smooth_path
from services.ml_predictor import flood_predictor
from config import ROUTING_NEAREST_NODE_MAX_M

logger = logging.getLogger("routing")

router = APIRouter(prefix="/api/v1/routing", tags=["routing"])


@router.get("/safe-path")
async def safe_path(
    start_lng: float = Query(..., description="Kinh độ điểm xuất phát"),
    start_lat: float = Query(..., description="Vĩ độ điểm xuất phát"),
    end_lng: float = Query(..., description="Kinh độ điểm đích"),
    end_lat: float = Query(..., description="Vĩ độ điểm đích"),
    vehicle_type: str = Query("motorbike", description="Loại xe: motorbike, car, suv"),
    nearest_node_max_m: int = Query(None, description="Bán kính tìm node gần nhất (m)"),
):
    """
    Find the safest route avoiding flooded roads.

    Uses Bidirectional A* with flood penalty based on vehicle wading depth.
    """
    # ── Validate vehicle ──────────────────────────────────────────────────
    vehicle = parse_vehicle_type(vehicle_type)
    if vehicle is None:
        allowed = ", ".join(VEHICLE_PROFILES.keys())
        raise HTTPException(
            status_code=400,
            detail=f"vehicle_type không hợp lệ. Cho phép: {allowed}",
        )

    # ── Validate coordinates ──────────────────────────────────────────────
    for name, val in [("start_lng", start_lng), ("start_lat", start_lat),
                      ("end_lng", end_lng), ("end_lat", end_lat)]:
        if not math.isfinite(val):
            raise HTTPException(status_code=400, detail=f"{name} không hợp lệ.")

    max_nearest = max(150, min(5000, nearest_node_max_m or ROUTING_NEAREST_NODE_MAX_M))

    # ── Check graph is loaded ─────────────────────────────────────────────
    snap = graph_cache.snapshot
    if snap is None or snap.edge_count == 0:
        raise HTTPException(
            status_code=503,
            detail="Graph chưa được load. Vui lòng đợi hoặc kiểm tra DB.",
        )

    # ── Find candidate nodes (avoid snapping to wrong carriageway) ───────
    start_candidates = await graph_cache.get_nearest_nodes(start_lng, start_lat, max_nearest, limit=6)
    end_candidates = await graph_cache.get_nearest_nodes(end_lng, end_lat, max_nearest, limit=6)

    if not start_candidates or not end_candidates:
        raise HTTPException(
            status_code=400,
            detail="Không tìm thấy road node gần điểm đầu/cuối. Cần nạp dữ liệu road_nodes.",
        )

    if all(c["id"] not in snap.adj_forward for c in start_candidates) or all(c["id"] not in snap.adj_forward for c in end_candidates):
        raise HTTPException(
            status_code=400,
            detail="Start/End node không nằm trong đồ thị đường đang active.",
        )

    # ── Run A* ────────────────────────────────────────────────────────────
    is_dry = not snap.has_any_flood

    best_result = None
    best_start = None
    best_end = None

    # Evaluate multiple snap combinations, then pick minimum total score
    # (path cost + tiny snap penalty). This reduces wrong-way routes caused
    # by choosing a nearest node on the opposite carriageway.
    for s in start_candidates:
        s_id = s["id"]
        if s_id not in snap.adj_forward:
            continue
        for e in end_candidates:
            e_id = e["id"]
            if e_id not in snap.adj_forward:
                continue
            r = find_path(
                snap=snap,
                start_id=s_id,
                end_id=e_id,
                vehicle=vehicle,
                is_dry=is_dry,
            )
            if r is None:
                continue
            snap_penalty = float(s["distance_m"]) + float(e["distance_m"])
            score = r.total_cost + snap_penalty
            if best_result is None or score < (best_result.total_cost + float(best_start["distance_m"]) + float(best_end["distance_m"])):
                best_result = r
                best_start = s
                best_end = e

    result = best_result
    start_node = best_start or start_candidates[0]
    end_node = best_end or end_candidates[0]

    # ── ML prediction info (optional) ─────────────────────────────────────
    ml_info = flood_predictor.get_prediction_info()

    if result is None:
        data = {
            "found": False,
            "reason": "Không tìm thấy đường đi an toàn (có thể tất cả nhánh bị ngập quá ngưỡng xe).",
            "vehicle": {"name": vehicle.name, "maxWadingDepthCm": vehicle.max_wading_depth_cm},
            "start_node": start_node,
            "end_node": end_node,
        }
        if ml_info:
            data["ml_prediction"] = ml_info
        return {
            "success": True,
            "data": data,
        }

    # ── Build segment output ──────────────────────────────────────────────
    segments = []
    total_length_m = 0.0
    total_time_sec = 0.0

    for i in range(1, len(result.node_path)):
        to_node_id = result.node_path[i]
        from_node_id = result.node_path[i - 1]
        edge = result.came_by_edge.get(to_node_id)
        if edge is None:
            continue

        from_pos = snap.node_pos.get(from_node_id)
        to_pos = snap.node_pos.get(to_node_id)
        total_length_m += edge.length_m
        total_time_sec += edge.length_m / edge.speed_limit_mps

        segments.append({
            "edge_id": edge.edge_id,
            "from_node_id": from_node_id,
            "to_node_id": to_node_id,
            "length_m": round(edge.length_m, 2),
            "speed_limit_mps": edge.speed_limit_mps,
            "flood_depth_cm": round(edge.flood_depth_cm, 2),
            "from": {"lng": from_pos.lng, "lat": from_pos.lat} if from_pos else None,
            "to": {"lng": to_pos.lng, "lat": to_pos.lat} if to_pos else None,
        })

    # ── Path smoothing ────────────────────────────────────────────────────
    segments = smooth_path(segments, snap.node_pos)

    # ── Build response (same contract as Node.js) ─────────────────────────
    from config import (
        ROUTING_CROWD_REPORT_HOURS,
        ROUTING_CROWD_EDGE_BUFFER_M,
        ROUTING_CROWD_RECENCY_HALF_LIFE_HOURS,
        ROUTING_CROWD_MIN_RELIABILITY,
        ROUTING_CROWD_MAX_BOOST,
        ROUTING_SENSOR_FLOOD_RADIUS_M,
        ROUTING_SENSOR_FLOOD_DECAY,
    )

    data = {
        "found": True,
        "vehicle": {"name": vehicle.name, "maxWadingDepthCm": vehicle.max_wading_depth_cm},
        "flood_sources": {
            "crowd_report_hours": ROUTING_CROWD_REPORT_HOURS,
            "crowd_edge_buffer_m": ROUTING_CROWD_EDGE_BUFFER_M,
            "crowd_recency_half_life_hours": ROUTING_CROWD_RECENCY_HALF_LIFE_HOURS,
            "crowd_min_reliability": ROUTING_CROWD_MIN_RELIABILITY,
            "crowd_max_boost": ROUTING_CROWD_MAX_BOOST,
            "sensor_flood_radius_m": ROUTING_SENSOR_FLOOD_RADIUS_M,
            "sensor_flood_decay": ROUTING_SENSOR_FLOOD_DECAY,
        },
        "start_node": start_node,
        "end_node": end_node,
        "node_path": result.node_path,
        "route": {
            "total_cost_sec": round(total_time_sec, 2),
            "total_distance_m": round(total_length_m, 2),
            "segments": segments,
        },
        "avoided": {
            "blocked_edge_ids": result.blocked_edge_ids,
            "near_limit_edge_ids": result.near_limit_edge_ids,
        },
    }

    if ml_info:
        data["ml_prediction"] = ml_info

    return {"success": True, "data": data}
