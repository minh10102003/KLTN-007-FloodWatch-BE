"""
Unit tests for flood penalty logic.
"""
import sys
import os
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.flood_penalty import (
    flood_penalty,
    road_class_factor,
    compute_edge_cost,
    parse_vehicle_type,
    VehicleProfile,
    VEHICLE_PROFILES,
)


MOTORBIKE = VEHICLE_PROFILES["motorbike"]  # max 20cm
CAR = VEHICLE_PROFILES["car"]              # max 30cm
SUV = VEHICLE_PROFILES["suv"]              # max 50cm


def test_flood_penalty_no_flood():
    assert flood_penalty(0, 20) == 1.0
    assert flood_penalty(-5, 20) == 1.0


def test_flood_penalty_light():
    """Depth ≤ 50% max → 1.5x"""
    assert flood_penalty(5, 20) == 1.5    # 5 ≤ 10 (50% of 20)
    assert flood_penalty(10, 20) == 1.5   # exactly 50%


def test_flood_penalty_heavy():
    """Depth > 50% and ≤ 100% max → gradient between 5.0 and 8.0"""
    p = flood_penalty(15, 20)  # 75% of max
    assert 5.0 < p < 8.0  # gradient penalty


def test_flood_penalty_blocked():
    """Depth > max → infinity"""
    assert flood_penalty(25, 20) == math.inf


def test_road_class_factor():
    assert road_class_factor(16.67) == 0.85   # highway
    assert road_class_factor(8.33) == 0.92    # main road
    assert road_class_factor(5.56) == 1.0     # secondary
    assert road_class_factor(2.78) == 1.15    # alley


def test_compute_edge_cost_dry():
    cost, blocked, near_limit = compute_edge_cost(
        length_m=100, speed_limit_mps=10, flood_depth_cm=50,
        vehicle=MOTORBIKE, is_dry=True,
    )
    assert cost == 100  # just distance
    assert not blocked
    assert not near_limit


def test_compute_edge_cost_blocked():
    cost, blocked, near_limit = compute_edge_cost(
        length_m=100, speed_limit_mps=10, flood_depth_cm=25,
        vehicle=MOTORBIKE, is_dry=False,
    )
    assert math.isinf(cost)
    assert blocked


def test_compute_edge_cost_near_limit():
    cost, blocked, near_limit = compute_edge_cost(
        length_m=100, speed_limit_mps=10, flood_depth_cm=15,
        vehicle=MOTORBIKE, is_dry=False,  # 15 > 50% of 20 → penalty ≥ 5.0
    )
    assert not blocked
    assert near_limit
    assert cost > 0


def test_parse_vehicle_type():
    assert parse_vehicle_type("motorbike") is not None
    assert parse_vehicle_type("car") is not None
    assert parse_vehicle_type("suv") is not None
    assert parse_vehicle_type("MOTORBIKE") is not None  # case insensitive
    assert parse_vehicle_type("bicycle") is None
    assert parse_vehicle_type(None) is not None  # defaults to motorbike


def test_vehicle_profiles_data():
    assert MOTORBIKE.max_wading_depth_cm == 20
    assert CAR.max_wading_depth_cm == 30
    assert SUV.max_wading_depth_cm == 50


if __name__ == "__main__":
    test_flood_penalty_no_flood()
    print("[PASS] test_flood_penalty_no_flood")

    test_flood_penalty_light()
    print("[PASS] test_flood_penalty_light")

    test_flood_penalty_heavy()
    print("[PASS] test_flood_penalty_heavy")

    test_flood_penalty_blocked()
    print("[PASS] test_flood_penalty_blocked")

    test_road_class_factor()
    print("[PASS] test_road_class_factor")

    test_compute_edge_cost_dry()
    print("[PASS] test_compute_edge_cost_dry")

    test_compute_edge_cost_blocked()
    print("[PASS] test_compute_edge_cost_blocked")

    test_compute_edge_cost_near_limit()
    print("[PASS] test_compute_edge_cost_near_limit")

    test_parse_vehicle_type()
    print("[PASS] test_parse_vehicle_type")

    test_vehicle_profiles_data()
    print("[PASS] test_vehicle_profiles_data")

    print("\nAll flood penalty tests passed!")
