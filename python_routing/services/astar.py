"""
Bidirectional A* pathfinding with binary heap (heapq).

Key improvements over Node.js implementation:
1. heapq — O(log n) pop instead of O(n) linear scan
2. Bidirectional search — explores from both ends, ~50% fewer nodes
3. Closed set — never re-expands processed nodes
4. Heuristic: haversine / max_speed (admissible & consistent)
"""
from __future__ import annotations

import heapq
import math
from dataclasses import dataclass, field
from typing import Optional

from services.graph_loader import GraphSnapshot, NodePos, Edge
from services.flood_penalty import VehicleProfile, compute_edge_cost
from config import ROUTING_UTURN_PENALTY_M, ROUTING_UTURN_PENALTY_SEC


# ── Result types ──────────────────────────────────────────────────────────────

@dataclass
class RoutingResult:
    node_path: list[int]
    came_by_edge: dict[int, Edge]  # node_id → edge that was used to reach it
    blocked_edge_ids: list[int]
    near_limit_edge_ids: list[int]
    total_cost: float  # seconds or meters depending on dry/wet


# ── Haversine helper ─────────────────────────────────────────────────────────

def _haversine_meters(a: NodePos, b: NodePos) -> float:
    R = 6_371_000
    to_rad = math.radians
    d_lat = to_rad(b.lat - a.lat)
    d_lng = to_rad(b.lng - a.lng)
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(to_rad(a.lat)) * math.cos(to_rad(b.lat)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(h))


def _edge_allowed_for_vehicle(edge: Edge, vehicle: VehicleProfile) -> bool:
    if vehicle.key in {"car", "suv"} and not edge.motorcar_allowed:
        return False
    if vehicle.key == "motorbike":
        if not edge.motorcycle_allowed:
            return False
        if (edge.highway or "").startswith("motorway"):
            return False
    return True


def _uturn_penalty(previous: Edge | None, candidate: Edge, is_dry: bool) -> float:
    if previous is None:
        return 0.0
    # Immediate reversal to previous node is treated as U-turn and penalized.
    if previous.from_node == candidate.to_node:
        return ROUTING_UTURN_PENALTY_M if is_dry else ROUTING_UTURN_PENALTY_SEC
    return 0.0


# ── Unidirectional A* (fallback, simpler) ────────────────────────────────────

def unidirectional_astar(
    snap: GraphSnapshot,
    start_id: int,
    end_id: int,
    vehicle: VehicleProfile,
    is_dry: bool,
) -> RoutingResult | None:
    """
    Standard A* with heapq. Used as fallback or for small graphs.
    """
    node_pos = snap.node_pos
    adj = snap.adj_forward

    if start_id not in node_pos or end_id not in node_pos:
        return None

    # Compute max speed for heuristic (only in flood mode)
    max_speed = 1.0
    if not is_dry:
        for edges in adj.values():
            for e in edges:
                if e.speed_limit_mps > max_speed:
                    max_speed = e.speed_limit_mps

    end_pos = node_pos[end_id]

    def heuristic(node_id: int) -> float:
        pos = node_pos.get(node_id)
        if pos is None:
            return 0.0
        dist = _haversine_meters(pos, end_pos)
        return dist if is_dry else dist / max_speed

    # Priority queue: (f_score, counter, node_id)
    counter = 0
    open_heap: list[tuple[float, int, int]] = []
    g_score: dict[int, float] = {start_id: 0.0}
    came_from: dict[int, int] = {}
    came_by_edge: dict[int, Edge] = {}
    closed: set[int] = set()
    blocked_edges: set[int] = set()
    near_limit_edges: set[int] = set()

    h0 = heuristic(start_id)
    heapq.heappush(open_heap, (h0, counter, start_id))
    counter += 1

    while open_heap:
        f, _, current = heapq.heappop(open_heap)

        if current == end_id:
            # Reconstruct path
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            path.reverse()
            return RoutingResult(
                node_path=path,
                came_by_edge=came_by_edge,
                blocked_edge_ids=list(blocked_edges),
                near_limit_edge_ids=list(near_limit_edges),
                total_cost=g_score.get(end_id, 0.0),
            )

        if current in closed:
            continue
        closed.add(current)

        for edge in adj.get(current, []):
            if edge.to_node in closed:
                continue
            if not _edge_allowed_for_vehicle(edge, vehicle):
                blocked_edges.add(edge.edge_id)
                continue

            cost, is_blocked, is_near_limit = compute_edge_cost(
                edge.length_m,
                edge.speed_limit_mps,
                edge.flood_depth_cm,
                vehicle,
                is_dry,
            )

            if is_blocked:
                blocked_edges.add(edge.edge_id)
                continue
            if is_near_limit:
                near_limit_edges.add(edge.edge_id)

            prev_edge = came_by_edge.get(current)
            tentative_g = g_score[current] + cost + _uturn_penalty(prev_edge, edge, is_dry)
            if tentative_g < g_score.get(edge.to_node, math.inf):
                g_score[edge.to_node] = tentative_g
                came_from[edge.to_node] = current
                came_by_edge[edge.to_node] = edge
                f_new = tentative_g + heuristic(edge.to_node)
                heapq.heappush(open_heap, (f_new, counter, edge.to_node))
                counter += 1

    return None


# ── Bidirectional A* ──────────────────────────────────────────────────────────

def bidirectional_astar(
    snap: GraphSnapshot,
    start_id: int,
    end_id: int,
    vehicle: VehicleProfile,
    is_dry: bool,
) -> RoutingResult | None:
    """
    Bidirectional A* search — searches from both start and end simultaneously.

    Advantages:
    - Explores ~50% fewer nodes than unidirectional
    - Still optimal with consistent heuristic

    Falls back to unidirectional A* if the graph doesn't have backward adjacency.
    """
    node_pos = snap.node_pos
    adj_fwd = snap.adj_forward
    adj_bwd = snap.adj_backward

    if start_id not in node_pos or end_id not in node_pos:
        return None

    # If no backward adjacency, fall back to unidirectional
    if not adj_bwd:
        return unidirectional_astar(snap, start_id, end_id, vehicle, is_dry)

    # Max speed for heuristic
    max_speed = 1.0
    if not is_dry:
        for edges in adj_fwd.values():
            for e in edges:
                if e.speed_limit_mps > max_speed:
                    max_speed = e.speed_limit_mps

    start_pos = node_pos[start_id]
    end_pos = node_pos[end_id]

    def h_forward(node_id: int) -> float:
        pos = node_pos.get(node_id)
        if pos is None:
            return 0.0
        dist = _haversine_meters(pos, end_pos)
        return dist if is_dry else dist / max_speed

    def h_backward(node_id: int) -> float:
        pos = node_pos.get(node_id)
        if pos is None:
            return 0.0
        dist = _haversine_meters(pos, start_pos)
        return dist if is_dry else dist / max_speed

    # Forward search state
    counter = 0
    open_fwd: list[tuple[float, int, int]] = []
    g_fwd: dict[int, float] = {start_id: 0.0}
    came_from_fwd: dict[int, int] = {}
    came_by_edge_fwd: dict[int, Edge] = {}
    closed_fwd: set[int] = set()

    # Backward search state
    open_bwd: list[tuple[float, int, int]] = []
    g_bwd: dict[int, float] = {end_id: 0.0}
    came_from_bwd: dict[int, int] = {}
    came_by_edge_bwd: dict[int, Edge] = {}
    closed_bwd: set[int] = set()

    blocked_edges: set[int] = set()
    near_limit_edges: set[int] = set()

    # Best meeting point
    mu = math.inf  # best known path cost
    meeting_node: int | None = None

    heapq.heappush(open_fwd, (h_forward(start_id), counter, start_id))
    counter += 1
    heapq.heappush(open_bwd, (h_backward(end_id), counter, end_id))
    counter += 1

    def _expand_forward():
        nonlocal mu, meeting_node, counter
        if not open_fwd:
            return False

        f, _, current = heapq.heappop(open_fwd)
        if current in closed_fwd:
            return True
        closed_fwd.add(current)

        # Check if we can terminate
        if f >= mu:
            return False

        for edge in adj_fwd.get(current, []):
            if edge.to_node in closed_fwd:
                continue
            if not _edge_allowed_for_vehicle(edge, vehicle):
                blocked_edges.add(edge.edge_id)
                continue

            cost, is_blocked, is_near_limit = compute_edge_cost(
                edge.length_m, edge.speed_limit_mps, edge.flood_depth_cm,
                vehicle, is_dry,
            )
            if is_blocked:
                blocked_edges.add(edge.edge_id)
                continue
            if is_near_limit:
                near_limit_edges.add(edge.edge_id)

            prev_edge = came_by_edge_fwd.get(current)
            tentative = g_fwd[current] + cost + _uturn_penalty(prev_edge, edge, is_dry)
            if tentative < g_fwd.get(edge.to_node, math.inf):
                g_fwd[edge.to_node] = tentative
                came_from_fwd[edge.to_node] = current
                came_by_edge_fwd[edge.to_node] = edge
                f_new = tentative + h_forward(edge.to_node)
                heapq.heappush(open_fwd, (f_new, counter, edge.to_node))
                counter += 1

                # Check meeting
                if edge.to_node in g_bwd:
                    total = tentative + g_bwd[edge.to_node]
                    if total < mu:
                        mu = total
                        meeting_node = edge.to_node
        return True

    def _expand_backward():
        nonlocal mu, meeting_node, counter
        if not open_bwd:
            return False

        f, _, current = heapq.heappop(open_bwd)
        if current in closed_bwd:
            return True
        closed_bwd.add(current)

        if f >= mu:
            return False

        for edge in adj_bwd.get(current, []):
            if edge.to_node in closed_bwd:
                continue
            if not _edge_allowed_for_vehicle(edge, vehicle):
                blocked_edges.add(edge.edge_id)
                continue

            cost, is_blocked, is_near_limit = compute_edge_cost(
                edge.length_m, edge.speed_limit_mps, edge.flood_depth_cm,
                vehicle, is_dry,
            )
            if is_blocked:
                blocked_edges.add(edge.edge_id)
                continue
            if is_near_limit:
                near_limit_edges.add(edge.edge_id)

            prev_edge = came_by_edge_bwd.get(current)
            tentative = g_bwd[current] + cost + _uturn_penalty(prev_edge, edge, is_dry)
            if tentative < g_bwd.get(edge.to_node, math.inf):
                g_bwd[edge.to_node] = tentative
                came_from_bwd[edge.to_node] = current
                came_by_edge_bwd[edge.to_node] = edge
                f_new = tentative + h_backward(edge.to_node)
                heapq.heappush(open_bwd, (f_new, counter, edge.to_node))
                counter += 1

                if edge.to_node in g_fwd:
                    total = tentative + g_fwd[edge.to_node]
                    if total < mu:
                        mu = total
                        meeting_node = edge.to_node
        return True

    # Alternate forward and backward
    while open_fwd or open_bwd:
        fwd_ok = _expand_forward()
        bwd_ok = _expand_backward()

        if not fwd_ok and not bwd_ok:
            break

    if meeting_node is None:
        return None

    # Reconstruct path: start → meeting_node → end
    # Forward path: start → meeting
    path_fwd = [meeting_node]
    cur = meeting_node
    while cur in came_from_fwd:
        cur = came_from_fwd[cur]
        path_fwd.append(cur)
    path_fwd.reverse()

    # Backward path: meeting → end
    path_bwd = []
    cur = meeting_node
    while cur in came_from_bwd:
        cur = came_from_bwd[cur]
        path_bwd.append(cur)

    full_path = path_fwd + path_bwd

    # Merge came_by_edge: for the backward part we need to map edges correctly
    merged_edges = dict(came_by_edge_fwd)
    # For backward path, the edges point from child → parent (reversed),
    # but we need from_node → to_node in path order
    for i in range(len(path_bwd)):
        node = path_bwd[i]
        if node in came_by_edge_bwd:
            bwd_edge = came_by_edge_bwd[node]
            # The backward edge has to_node pointing towards start,
            # but in our path it goes towards end. Create a corrected reference.
            if i == 0:
                # Edge from meeting_node to path_bwd[0]
                prev_node = meeting_node
            else:
                prev_node = path_bwd[i - 1]
            # We store edge keyed by destination in path
            merged_edges[node] = Edge(
                edge_id=bwd_edge.edge_id,
                to_node=node,
                from_node=prev_node,
                length_m=bwd_edge.length_m,
                speed_limit_mps=bwd_edge.speed_limit_mps,
                flood_depth_cm=bwd_edge.flood_depth_cm,
                is_bidirectional=bwd_edge.is_bidirectional,
            )

    return RoutingResult(
        node_path=full_path,
        came_by_edge=merged_edges,
        blocked_edge_ids=list(blocked_edges),
        near_limit_edge_ids=list(near_limit_edges),
        total_cost=mu,
    )


# ── Public API ────────────────────────────────────────────────────────────────

def find_path(
    snap: GraphSnapshot,
    start_id: int,
    end_id: int,
    vehicle: VehicleProfile,
    is_dry: bool,
    use_bidirectional: bool = True,
) -> RoutingResult | None:
    """
    Main entry point for pathfinding.

    Uses bidirectional A* by default; falls back to unidirectional if needed.
    """
    if use_bidirectional and snap.adj_backward:
        result = bidirectional_astar(snap, start_id, end_id, vehicle, is_dry)
        if result is not None:
            return result
        # Fallback to unidirectional if bidirectional found nothing
        # (shouldn't happen, but just in case)

    return unidirectional_astar(snap, start_id, end_id, vehicle, is_dry)
