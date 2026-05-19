"""
Kiểm thử chức năng 1.2 — Tìm đường di chuyển an toàn (Safe Routing).

Nghiệp vụ:
    Người dùng tìm đường A → B; hệ thống tự né các cung đường có
    trạm đo BÁO NGẬP hoặc CROWD REPORT đã duyệt báo ngập.

Kịch bản chính:
    Đặt 1 điểm ngập (sensor báo) **trên đường ngắn nhất** A → B,
    kiểm tra A* có "vẽ đường vòng" hay không.

Đồ thị mô phỏng (vô hướng, 5 nút):

            (B)
           /    \\
        (A)      (D) ── (E)         A=1, B=2, C=3, D=4, E=5
           \\    /
            (C)  ← điểm ngập (sensor) trên đường ngắn nhất A→…→E

    Cạnh & length_m:
        A-B: 100   B-D: 100
        A-C:  90   C-D:  90     ← ngắn hơn (1→3→4→5 = 280m)
        D-E: 100                ← phương án vòng: 1→2→4→5 = 300m

Kỳ vọng:
    - Khi không có ngập:           1 → 3 → 4 → 5  (280 m, ngắn nhất)
    - Khi sensor C báo ngập:        1 → 2 → 4 → 5  (300 m, đường vòng an toàn)
    - Khi crowd báo ngập tại C:    cùng kết quả như trên (vì cách mô phỏng
      bằng flood_depth_cm lớn không phân biệt nguồn sensor/crowd ở tầng A*).
    - Khi cả C và B đều ngập:      `find_path` trả về None.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.graph_loader import GraphSnapshot, Edge, NodePos  # noqa: E402
from services.flood_penalty import VehicleProfile  # noqa: E402
from services.astar import find_path  # noqa: E402


MOTORBIKE = VehicleProfile(key="motorbike", name="Xe máy", max_wading_depth_cm=20)


EDGES_5_NODES = [
    {"id": 12, "from": 1, "to": 2, "length_m": 100},
    {"id": 13, "from": 1, "to": 3, "length_m": 90},
    {"id": 24, "from": 2, "to": 4, "length_m": 100},
    {"id": 34, "from": 3, "to": 4, "length_m": 90},
    {"id": 45, "from": 4, "to": 5, "length_m": 100},
]


def _build_graph(flooded_nodes: set[int] | None = None) -> GraphSnapshot:
    """
    Mô phỏng nguồn ngập: bất kỳ cạnh nào CHẠM một trong các nút
    trong ``flooded_nodes`` sẽ nhận flood_depth_cm = 1e9 (vô cực).

    Cách mô phỏng này tương đương với:
        - sensor báo ngập tại nút đó, hoặc
        - crowd report đã duyệt với độ ngập rất cao quanh nút đó.
    """
    flooded = flooded_nodes or set()
    snap = GraphSnapshot()
    for e in EDGES_5_NODES:
        f, t = e["from"], e["to"]
        length_m = float(e["length_m"])
        flood = 1e9 if (f in flooded or t in flooded) else 0.0

        forward = Edge(
            edge_id=e["id"], to_node=t, from_node=f,
            length_m=length_m, speed_limit_mps=8.33,
            flood_depth_cm=flood, is_bidirectional=True,
        )
        snap.adj_forward.setdefault(f, []).append(forward)
        snap.adj_backward.setdefault(t, []).append(
            Edge(
                edge_id=e["id"], to_node=f, from_node=t,
                length_m=length_m, speed_limit_mps=8.33,
                flood_depth_cm=flood, is_bidirectional=True,
            )
        )

        reverse = Edge(
            edge_id=e["id"], to_node=f, from_node=t,
            length_m=length_m, speed_limit_mps=8.33,
            flood_depth_cm=flood, is_bidirectional=True,
        )
        snap.adj_forward.setdefault(t, []).append(reverse)
        snap.adj_backward.setdefault(f, []).append(
            Edge(
                edge_id=e["id"], to_node=t, from_node=f,
                length_m=length_m, speed_limit_mps=8.33,
                flood_depth_cm=flood, is_bidirectional=True,
            )
        )

    coords = {
        1: (106.700, 10.800),
        2: (106.700, 10.802),
        3: (106.702, 10.800),
        4: (106.702, 10.802),
        5: (106.704, 10.802),
    }
    for nid, (lng, lat) in coords.items():
        snap.node_pos[nid] = NodePos(lng=lng, lat=lat)

    snap.node_count = len(snap.node_pos)
    snap.edge_count = len(EDGES_5_NODES)
    snap.has_any_flood = bool(flooded)
    return snap


# ── Test ─────────────────────────────────────────────────────────────────────

def test_no_flood_picks_shortest_path():
    """Không có ngập: A* chọn nhánh ngắn nhất A→C→D→E = 280m."""
    snap = _build_graph(flooded_nodes=set())
    result = find_path(snap, 1, 5, MOTORBIKE, is_dry=True)

    assert result is not None
    assert result.node_path == [1, 3, 4, 5]
    assert result.total_cost == 280.0


def test_sensor_flooded_node_forces_detour():
    """
    1 sensor trên đường ngắn nhất báo ngập (nút C = 3) → A* né, chuyển sang
    đường vòng A→B→D→E.
    """
    snap = _build_graph(flooded_nodes={3})
    result = find_path(snap, 1, 5, MOTORBIKE, is_dry=False)

    assert result is not None
    assert result.node_path == [1, 2, 4, 5]
    assert 3 not in result.node_path
    # Có ít nhất 1 cạnh chạm nút ngập bị A* loại
    assert {13, 34} & set(result.blocked_edge_ids)


def test_crowd_report_blocks_same_node_same_behaviour():
    """
    Crowd report đã duyệt mô phỏng bằng cùng cơ chế flood_depth_cm rất lớn
    quanh nút C → A* vẫn vẽ đường vòng (parity với nguồn sensor).
    """
    snap = _build_graph(flooded_nodes={3})
    result = find_path(snap, 1, 5, MOTORBIKE, is_dry=False)
    assert result is not None
    assert result.node_path == [1, 2, 4, 5]


def test_all_branches_flooded_returns_none():
    """Cả hai nhánh giữa A và E đều ngập → không còn đường an toàn → None."""
    snap = _build_graph(flooded_nodes={2, 3})
    result = find_path(snap, 1, 5, MOTORBIKE, is_dry=False)
    assert result is None
