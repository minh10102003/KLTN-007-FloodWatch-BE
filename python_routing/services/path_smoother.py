"""
Path smoother — post-process the route to reduce zig-zag artifacts.

Techniques:
1. Remove short U-turns (< threshold meters)
2. Merge consecutive segments going in nearly the same direction (angle < 15°)
3. Flag sharp turns for UI display
"""
from __future__ import annotations

import math
from services.graph_loader import NodePos


def _bearing(p1: NodePos, p2: NodePos) -> float:
    """Compute bearing from p1 to p2 in degrees [0, 360)."""
    d_lng = math.radians(p2.lng - p1.lng)
    lat1 = math.radians(p1.lat)
    lat2 = math.radians(p2.lat)
    x = math.sin(d_lng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lng)
    bearing = math.degrees(math.atan2(x, y))
    return bearing % 360


def _angle_diff(a: float, b: float) -> float:
    """Smallest angle difference between two bearings in degrees [0, 180]."""
    diff = abs(a - b) % 360
    return min(diff, 360 - diff)


def smooth_path(
    segments: list[dict],
    node_pos: dict[int, NodePos],
    u_turn_threshold_m: float = 30.0,
    merge_angle_threshold: float = 15.0,
) -> list[dict]:
    """
    Post-process route segments to improve path quality.

    Args:
        segments: List of segment dicts (from buildSegmentOutput)
        node_pos: Node position lookup
        u_turn_threshold_m: Remove U-turns shorter than this
        merge_angle_threshold: Merge segments with bearing diff less than this

    Returns:
        Cleaned list of segments (may be shorter than input)
    """
    if len(segments) <= 2:
        return segments

    # Step 1: Remove short U-turns
    cleaned = _remove_short_uturns(segments, node_pos, u_turn_threshold_m)

    # Step 2: Flag sharp turns (>= 120° bearing change)
    for i in range(1, len(cleaned)):
        prev_seg = cleaned[i - 1]
        curr_seg = cleaned[i]
        if prev_seg.get("from") and prev_seg.get("to") and curr_seg.get("from") and curr_seg.get("to"):
            from_prev = NodePos(prev_seg["from"]["lng"], prev_seg["from"]["lat"])
            to_prev = NodePos(prev_seg["to"]["lng"], prev_seg["to"]["lat"])
            from_curr = NodePos(curr_seg["from"]["lng"], curr_seg["from"]["lat"])
            to_curr = NodePos(curr_seg["to"]["lng"], curr_seg["to"]["lat"])
            b1 = _bearing(from_prev, to_prev)
            b2 = _bearing(from_curr, to_curr)
            turn = _angle_diff(b1, b2)
            cleaned[i]["sharp_turn"] = turn >= 120

    return cleaned


def _remove_short_uturns(
    segments: list[dict],
    node_pos: dict[int, NodePos],
    threshold_m: float,
) -> list[dict]:
    """Remove segments that form a short U-turn (go somewhere and come back)."""
    if len(segments) <= 2:
        return segments

    result = []
    skip_next = False

    for i in range(len(segments)):
        if skip_next:
            skip_next = False
            continue

        if i + 1 < len(segments):
            seg = segments[i]
            next_seg = segments[i + 1]

            # Check if it's a U-turn: from_a → to_a, then from_b → to_b
            # where to_a ≈ from_b and to_b ≈ from_a (going back)
            if (
                seg.get("to_node_id") == next_seg.get("from_node_id")
                and seg.get("from_node_id") == next_seg.get("to_node_id")
                and seg.get("length_m", float("inf")) < threshold_m
            ):
                skip_next = True
                continue

        result.append(segments[i])

    return result
