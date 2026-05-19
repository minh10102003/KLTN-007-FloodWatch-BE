"""
Kịch bản kiểm thử cho luận văn (Thuật toán A* — Backend Python).

Mục tiêu:
    Giả lập một đồ thị giao thông nhỏ (5 nút) — gán cho một nút bị "ngập"
    (trọng số = vô cực thông qua flood_depth_cm rất lớn) — và xác minh rằng
    A* sẽ tìm được lộ trình NÉ vùng ngập đúng kịch bản kỳ vọng.

Đồ thị mô phỏng (vô hướng, hai chiều):

            (2)
           /    \\
        (1)      (4) ── (5)
           \\    /
            (3)  ← NÚT BỊ NGẬP (flood_depth_cm = ∞)

Cạnh & độ dài (m):
    1↔2 : 100        2↔4 : 100
    1↔3 :  90 (sẽ bị block do nút 3 ngập)
    3↔4 :  90 (sẽ bị block do nút 3 ngập)
    4↔5 : 100

Kỳ vọng:
    Khi có ngập: 1 → 2 → 4 → 5   (né nút 3)
    Khi không ngập (is_dry=True): có thể đi 1 → 3 → 4 → 5 (ngắn hơn 10 m)
"""
from __future__ import annotations

import math
import os
import sys

# Cho phép pytest tìm thấy services/, config/, … khi chạy từ bất kỳ thư mục nào.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.graph_loader import GraphSnapshot, Edge, NodePos  # noqa: E402
from services.flood_penalty import VehicleProfile  # noqa: E402
from services.astar import find_path  # noqa: E402


MOTORBIKE = VehicleProfile(key="motorbike", name="Xe máy", max_wading_depth_cm=20)


# ── Helper: dựng đồ thị 5 nút theo bảng cạnh ─────────────────────────────────

def _build_graph(edges_data: list[dict], flooded_nodes: set[int] | None = None) -> GraphSnapshot:
    """
    Dựng GraphSnapshot từ danh sách cạnh (không phụ thuộc DB).

    Nếu một cạnh chạm vào ``flooded_nodes`` thì cạnh đó nhận
    ``flood_depth_cm`` = số rất lớn (1e9) → flood_penalty → math.inf
    → A* xem như cạnh bị chặn vĩnh viễn (trọng số = vô cực).
    """
    flooded = flooded_nodes or set()
    snap = GraphSnapshot()

    for e in edges_data:
        f, t = e["from"], e["to"]
        length_m = float(e.get("length_m", 100))
        speed = float(e.get("speed", 8.33))

        # Cạnh chạm nút ngập → trọng số ngập = ∞ (mô phỏng "trọng số = vô cực")
        flood = 1e9 if (f in flooded or t in flooded) else 0.0

        # Cạnh thuận chiều
        fwd = Edge(
            edge_id=e["id"],
            to_node=t,
            from_node=f,
            length_m=length_m,
            speed_limit_mps=speed,
            flood_depth_cm=flood,
            is_bidirectional=True,
        )
        snap.adj_forward.setdefault(f, []).append(fwd)
        snap.adj_backward.setdefault(t, []).append(
            Edge(
                edge_id=e["id"],
                to_node=f,
                from_node=t,
                length_m=length_m,
                speed_limit_mps=speed,
                flood_depth_cm=flood,
                is_bidirectional=True,
            )
        )

        # Cạnh ngược chiều (hai chiều)
        rev = Edge(
            edge_id=e["id"],
            to_node=f,
            from_node=t,
            length_m=length_m,
            speed_limit_mps=speed,
            flood_depth_cm=flood,
            is_bidirectional=True,
        )
        snap.adj_forward.setdefault(t, []).append(rev)
        snap.adj_backward.setdefault(f, []).append(
            Edge(
                edge_id=e["id"],
                to_node=t,
                from_node=f,
                length_m=length_m,
                speed_limit_mps=speed,
                flood_depth_cm=flood,
                is_bidirectional=True,
            )
        )

    # Vị trí lat/lng tượng trưng (không ảnh hưởng độ chính xác — heuristic
    # chỉ dùng để xếp hạng); đặt theo lưới quanh trung tâm TP.HCM.
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
    snap.edge_count = len(edges_data)
    snap.has_any_flood = bool(flooded)
    return snap


EDGES_5_NODES = [
    {"id": 12, "from": 1, "to": 2, "length_m": 100},
    {"id": 13, "from": 1, "to": 3, "length_m": 90},
    {"id": 24, "from": 2, "to": 4, "length_m": 100},
    {"id": 34, "from": 3, "to": 4, "length_m": 90},
    {"id": 45, "from": 4, "to": 5, "length_m": 100},
]


# ── Kịch bản chính: lộ trình né vùng ngập ────────────────────────────────────

def test_path_avoids_flooded_node():
    """
    Kịch bản: nút 3 bị ngập → A* phải đi 1 → 2 → 4 → 5 thay vì 1 → 3 → 4 → 5.

    Đây là `assert find_path(start, end, flood_data) == expected_safe_path`
    theo yêu cầu kiểm thử của luận văn.
    """
    snap = _build_graph(EDGES_5_NODES, flooded_nodes={3})

    result = find_path(snap, start_id=1, end_id=5, vehicle=MOTORBIKE, is_dry=False)

    assert result is not None, "Phải tìm được lộ trình thay thế khi có ngập."

    expected_safe_path = [1, 2, 4, 5]
    assert result.node_path == expected_safe_path, (
        f"Lộ trình thực tế: {result.node_path}; "
        f"Lộ trình an toàn kỳ vọng: {expected_safe_path}"
    )

    # Lộ trình tuyệt đối KHÔNG được đi qua nút bị ngập.
    assert 3 not in result.node_path

    # Ít nhất một cạnh chạm nút 3 phải bị A* nhận diện là bị chặn do ngập.
    # (Bidirectional A* có thể kết thúc sớm, không nhất thiết khám phá hết
    # mọi cạnh chạm nút ngập — đó là hành vi tối ưu, chấp nhận được.)
    flooded_edge_ids = {13, 34}
    assert flooded_edge_ids & set(result.blocked_edge_ids), (
        f"Phải có ít nhất một cạnh ngập trong blocked_edge_ids; "
        f"thực tế: {result.blocked_edge_ids}"
    )


def test_dry_path_takes_shorter_via_flooded_node():
    """
    Khi không có ngập (is_dry=True), A* tự do chọn lộ trình ngắn nhất —
    qua nút 3 (1→3→4→5 = 280 m) thay vì né (1→2→4→5 = 300 m).

    Test này đảm bảo: lý do A* né nút 3 ở test trên thực sự là *do flood*,
    không phải do bug đồ thị.
    """
    snap = _build_graph(EDGES_5_NODES, flooded_nodes=set())

    result = find_path(snap, start_id=1, end_id=5, vehicle=MOTORBIKE, is_dry=True)

    assert result is not None
    assert result.node_path == [1, 3, 4, 5]
    assert math.isclose(result.total_cost, 280.0, rel_tol=1e-6)


def test_no_safe_path_when_all_routes_flooded():
    """
    Nếu cả nút 2 và nút 3 đều ngập → không còn đường nào tới nút 5 →
    `find_path` phải trả về None (lộ trình không tồn tại).
    """
    snap = _build_graph(EDGES_5_NODES, flooded_nodes={2, 3})

    result = find_path(snap, start_id=1, end_id=5, vehicle=MOTORBIKE, is_dry=False)

    assert result is None, "Khi mọi nhánh đều ngập, A* phải báo không có lộ trình."


# ── Runner CLI tiện cho luận văn (chạy không cần pytest) ─────────────────────

if __name__ == "__main__":
    # Windows PowerShell mặc định cp1252 không in được tiếng Việt — ép UTF-8.
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

    cases = [
        ("Né vùng ngập (nút 3)", test_path_avoids_flooded_node),
        ("Dry mode — đi qua nút 3 (ngắn hơn)", test_dry_path_takes_shorter_via_flooded_node),
        ("Không còn lộ trình khi ngập 2 & 3", test_no_safe_path_when_all_routes_flooded),
    ]
    failed: list[tuple[str, str]] = []
    for name, fn in cases:
        try:
            fn()
            print(f"[PASS] {name}")
        except AssertionError as exc:
            print(f"[FAIL] {name}: {exc}")
            failed.append((name, str(exc)))

    print()
    if failed:
        print(f"FAILED: {len(failed)}/{len(cases)}")
        sys.exit(1)
    print(f"PASSED: {len(cases)}/{len(cases)} — Lộ trình tìm được né vùng ngập đúng kịch bản.")
