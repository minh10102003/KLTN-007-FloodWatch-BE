"""
Unit tests for A* pathfinding algorithms.

Tests:
- Simple 2-node path
- Avoiding blocked edges
- Bidirectional vs unidirectional consistency
- Vehicle profile differences (motorbike blocked, SUV passes)
"""
import sys
import os
import math

# Add parent to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.graph_loader import GraphSnapshot, Edge, NodePos
from services.flood_penalty import VehicleProfile
from services.astar import unidirectional_astar, bidirectional_astar, find_path


def _make_snapshot(edges_data: list[dict]) -> GraphSnapshot:
    """Helper: build a GraphSnapshot from a list of edge dicts."""
    snap = GraphSnapshot()
    for e in edges_data:
        from_id = e["from"]
        to_id = e["to"]
        edge = Edge(
            edge_id=e.get("id", 0),
            to_node=to_id,
            from_node=from_id,
            length_m=e.get("length_m", 100),
            speed_limit_mps=e.get("speed", 8.33),
            flood_depth_cm=e.get("flood", 0),
            is_bidirectional=e.get("bidir", True),
        )
        snap.adj_forward.setdefault(from_id, []).append(edge)

        # Backward
        edge_back = Edge(
            edge_id=e.get("id", 0),
            to_node=from_id,
            from_node=to_id,
            length_m=e.get("length_m", 100),
            speed_limit_mps=e.get("speed", 8.33),
            flood_depth_cm=e.get("flood", 0),
            is_bidirectional=e.get("bidir", True),
        )
        snap.adj_backward.setdefault(to_id, []).append(edge_back)

        if e.get("bidir", True):
            rev = Edge(
                edge_id=e.get("id", 0),
                to_node=from_id,
                from_node=to_id,
                length_m=e.get("length_m", 100),
                speed_limit_mps=e.get("speed", 8.33),
                flood_depth_cm=e.get("flood", 0),
                is_bidirectional=True,
            )
            snap.adj_forward.setdefault(to_id, []).append(rev)

            rev_back = Edge(
                edge_id=e.get("id", 0),
                to_node=to_id,
                from_node=from_id,
                length_m=e.get("length_m", 100),
                speed_limit_mps=e.get("speed", 8.33),
                flood_depth_cm=e.get("flood", 0),
                is_bidirectional=True,
            )
            snap.adj_backward.setdefault(from_id, []).append(rev_back)

    # Positions
    for e in edges_data:
        f, t = e["from"], e["to"]
        if f not in snap.node_pos:
            snap.node_pos[f] = NodePos(lng=106.7 + f * 0.001, lat=10.8 + f * 0.001)
        if t not in snap.node_pos:
            snap.node_pos[t] = NodePos(lng=106.7 + t * 0.001, lat=10.8 + t * 0.001)

    snap.node_count = len(snap.node_pos)
    snap.edge_count = len(edges_data)
    return snap


MOTORBIKE = VehicleProfile(key="motorbike", name="Xe máy", max_wading_depth_cm=20)
SUV = VehicleProfile(key="suv", name="SUV", max_wading_depth_cm=50)


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_simple_two_node_path():
    """A→B direct path should always be found."""
    snap = _make_snapshot([{"id": 1, "from": 1, "to": 2, "length_m": 100}])
    result = find_path(snap, 1, 2, MOTORBIKE, is_dry=True)
    assert result is not None
    assert result.node_path == [1, 2]
    assert result.total_cost > 0


def test_three_node_chain():
    """A→B→C should find the path through B."""
    snap = _make_snapshot([
        {"id": 1, "from": 1, "to": 2, "length_m": 100},
        {"id": 2, "from": 2, "to": 3, "length_m": 150},
    ])
    result = find_path(snap, 1, 3, MOTORBIKE, is_dry=True)
    assert result is not None
    assert result.node_path == [1, 2, 3]


def test_avoids_blocked_edge():
    """When direct path is flooded beyond max, should find alternative."""
    snap = _make_snapshot([
        {"id": 1, "from": 1, "to": 3, "length_m": 100, "flood": 30},   # blocked for motorbike
        {"id": 2, "from": 1, "to": 2, "length_m": 80, "flood": 0},     # clear
        {"id": 3, "from": 2, "to": 3, "length_m": 80, "flood": 0},     # clear
    ])
    snap.has_any_flood = True
    result = find_path(snap, 1, 3, MOTORBIKE, is_dry=False)
    assert result is not None
    assert 2 in result.node_path  # goes through node 2
    assert 1 in result.blocked_edge_ids  # edge 1 was blocked


def test_suv_passes_where_motorbike_cant():
    """SUV (50cm max) can pass through 30cm flood, motorbike (20cm) can't."""
    snap = _make_snapshot([
        {"id": 1, "from": 1, "to": 2, "length_m": 100, "flood": 30},
    ])
    snap.has_any_flood = True

    result_bike = find_path(snap, 1, 2, MOTORBIKE, is_dry=False)
    result_suv = find_path(snap, 1, 2, SUV, is_dry=False)

    assert result_bike is None  # blocked (30 > 20)
    assert result_suv is not None  # passes (30 < 50)


def test_bidirectional_same_as_unidirectional():
    """Both algorithms should find the same optimal path on a simple graph."""
    snap = _make_snapshot([
        {"id": 1, "from": 1, "to": 2, "length_m": 100},
        {"id": 2, "from": 2, "to": 3, "length_m": 200},
        {"id": 3, "from": 1, "to": 3, "length_m": 350},
    ])

    result_uni = unidirectional_astar(snap, 1, 3, MOTORBIKE, is_dry=True)
    result_bi = bidirectional_astar(snap, 1, 3, MOTORBIKE, is_dry=True)

    assert result_uni is not None
    assert result_bi is not None

    # Both should find the shorter path (1→2→3 = 300m vs 1→3 = 350m)
    assert result_uni.total_cost <= 350
    assert result_bi.total_cost <= 350


def test_no_path_exists():
    """When no path exists, should return None."""
    snap = _make_snapshot([
        {"id": 1, "from": 1, "to": 2, "length_m": 100, "bidir": False},
    ])
    # 3 is isolated
    snap.node_pos[3] = NodePos(lng=106.71, lat=10.81)
    result = find_path(snap, 1, 3, MOTORBIKE, is_dry=True)
    assert result is None


def test_dry_network_mode():
    """In dry mode, flood penalty is ignored and cost is in meters."""
    snap = _make_snapshot([
        {"id": 1, "from": 1, "to": 2, "length_m": 100, "flood": 100},  # heavily flooded
    ])
    result = find_path(snap, 1, 2, MOTORBIKE, is_dry=True)
    assert result is not None  # flood ignored in dry mode
    assert result.total_cost == 100  # cost = distance in meters


def test_oneway_reverse_is_blocked():
    """If edge is one-way, reverse traversal should not be possible."""
    snap = GraphSnapshot()
    e = Edge(
        edge_id=1,
        from_node=1,
        to_node=2,
        length_m=100,
        speed_limit_mps=8.33,
        flood_depth_cm=0,
        is_bidirectional=False,
        oneway="yes",
    )
    snap.adj_forward.setdefault(1, []).append(e)
    snap.adj_backward.setdefault(2, []).append(
        Edge(
            edge_id=1,
            from_node=2,
            to_node=1,
            length_m=100,
            speed_limit_mps=8.33,
            flood_depth_cm=0,
            is_bidirectional=False,
            oneway="yes",
        )
    )
    snap.node_pos[1] = NodePos(lng=106.701, lat=10.801)
    snap.node_pos[2] = NodePos(lng=106.702, lat=10.802)

    assert find_path(snap, 2, 1, MOTORBIKE, is_dry=True) is None


def test_motorway_blocked_for_motorbike():
    """Motorbike should not route into motorway edges."""
    snap = _make_snapshot([
        {"id": 1, "from": 1, "to": 2, "length_m": 100},
    ])
    snap.adj_forward[1][0].highway = "motorway"
    snap.adj_backward[2][0].highway = "motorway"

    assert find_path(snap, 1, 2, MOTORBIKE, is_dry=True) is None


def test_oneway_negative_direction_only_reverse_allowed():
    """oneway=-1 means only reverse traversal is legal."""
    snap = GraphSnapshot()
    edge = Edge(
        edge_id=10,
        from_node=2,
        to_node=1,
        length_m=80,
        speed_limit_mps=8.33,
        flood_depth_cm=0,
        is_bidirectional=False,
        oneway="-1",
    )
    snap.adj_forward.setdefault(2, []).append(edge)
    snap.adj_backward.setdefault(1, []).append(
        Edge(
            edge_id=10,
            from_node=1,
            to_node=2,
            length_m=80,
            speed_limit_mps=8.33,
            flood_depth_cm=0,
            is_bidirectional=False,
            oneway="-1",
        )
    )
    snap.node_pos[1] = NodePos(lng=106.701, lat=10.801)
    snap.node_pos[2] = NodePos(lng=106.702, lat=10.802)

    assert find_path(snap, 1, 2, MOTORBIKE, is_dry=True) is None
    assert find_path(snap, 2, 1, MOTORBIKE, is_dry=True) is not None


if __name__ == "__main__":
    test_simple_two_node_path()
    print("[PASS] test_simple_two_node_path")

    test_three_node_chain()
    print("[PASS] test_three_node_chain")

    test_avoids_blocked_edge()
    print("[PASS] test_avoids_blocked_edge")

    test_suv_passes_where_motorbike_cant()
    print("[PASS] test_suv_passes_where_motorbike_cant")

    test_bidirectional_same_as_unidirectional()
    print("[PASS] test_bidirectional_same_as_unidirectional")

    test_no_path_exists()
    print("[PASS] test_no_path_exists")

    test_dry_network_mode()
    print("[PASS] test_dry_network_mode")

    test_oneway_reverse_is_blocked()
    print("[PASS] test_oneway_reverse_is_blocked")

    test_motorway_blocked_for_motorbike()
    print("[PASS] test_motorway_blocked_for_motorbike")

    test_oneway_negative_direction_only_reverse_allowed()
    print("[PASS] test_oneway_negative_direction_only_reverse_allowed")

    print("\nAll A* tests passed!")
