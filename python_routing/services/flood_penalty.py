"""
Vehicle profiles and flood penalty logic.

Giữ nguyên logic Node.js (floodPenalty: 1.0 / 1.5 / 5.0 / inf) và mở rộng
thêm near-limit gradient penalty + road class factor.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class VehicleProfile:
    key: str
    name: str
    max_wading_depth_cm: float


# ── Vehicle profiles (mirrors Node.js VEHICLE_PROFILES) ──────────────────────

VEHICLE_PROFILES: dict[str, VehicleProfile] = {
    "motorbike": VehicleProfile(key="motorbike", name="Xe máy", max_wading_depth_cm=10),
    "car": VehicleProfile(key="car", name="Ô tô con", max_wading_depth_cm=20),
    "suv": VehicleProfile(key="suv", name="SUV", max_wading_depth_cm=40),
}


def parse_vehicle_type(vehicle_type: str | None) -> VehicleProfile | None:
    """Parse vehicle_type string → VehicleProfile or None."""
    key = (vehicle_type or "motorbike").strip().lower()
    # FE/OSM hay dùng "motorcycle"; API chuẩn là "motorbike" (khớp Swagger).
    if key == "motorcycle":
        key = "motorbike"
    return VEHICLE_PROFILES.get(key)


# ── Flood penalty ─────────────────────────────────────────────────────────────

def flood_penalty(depth_cm: float, max_wading_cm: float) -> float:
    """
    Compute flood penalty multiplier for travel cost.

    Matches Node.js logic exactly:
      depth ≤ 0           → 1.0  (normal)
      depth ≤ 50% max     → 1.5  (slow down)
      depth ≤ max         → 5.0  (dangerous, very slow)
      depth > max          → inf  (blocked)

    Enhancement: near-limit gradient for smoother penalty transition.
    """
    d = float(depth_cm) if depth_cm else 0.0
    if d <= 0:
        return 1.0
    if d <= 0.5 * max_wading_cm:
        return 1.5
    if d <= max_wading_cm:
        # Near-limit gradient: increase penalty as depth approaches max
        ratio = (d - 0.5 * max_wading_cm) / (0.5 * max_wading_cm)
        # Smoothly interpolates between 5.0 (at 50% threshold) and 8.0 (at max threshold)
        return 5.0 + 3.0 * ratio
    return math.inf


def road_class_factor(speed_limit_mps: float) -> float:
    """
    Prefer major roads (higher speed limit ≈ larger road).

    factor < 1.0 → faster on big roads (preferred)
    factor > 1.0 → slower on small roads (penalized)

    Range: [0.85, 1.15]
    """
    # Normalize speed: typical range 2.78 m/s (10 km/h) to 16.67 m/s (60 km/h)
    if speed_limit_mps >= 13.89:  # ≥ 50 km/h — highway/trunk
        return 0.85
    if speed_limit_mps >= 8.33:  # ≥ 30 km/h — main road
        return 0.92
    if speed_limit_mps >= 5.56:  # ≥ 20 km/h — secondary
        return 1.0
    return 1.15  # small alley / residential


def compute_edge_cost(
    length_m: float,
    speed_limit_mps: float,
    flood_depth_cm: float,
    vehicle: VehicleProfile,
    is_dry: bool,
    ml_predicted_depth: float | None = None,
) -> tuple[float, bool, bool]:
    """
    Compute the traversal cost for an edge.

    Returns:
        (cost, is_blocked, is_near_limit)

    ``cost`` is in seconds for flood-aware mode, meters for dry mode.
    """
    if is_dry:
        return length_m, False, False

    # Use ML-predicted depth if available, otherwise sensor/crowd depth
    depth = ml_predicted_depth if ml_predicted_depth is not None else flood_depth_cm

    penalty = flood_penalty(depth, vehicle.max_wading_depth_cm)
    if not math.isfinite(penalty):
        return math.inf, True, False

    near_limit = penalty >= 5.0

    travel_sec = length_m / speed_limit_mps
    road_factor = road_class_factor(speed_limit_mps)
    cost = travel_sec * penalty * road_factor

    return cost, False, near_limit
