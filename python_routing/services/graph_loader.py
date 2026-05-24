"""
Graph Loader — Load road graph from DB, cache in-memory, refresh periodically.

This is the key performance improvement over Node.js: instead of querying DB
on every routing request, we keep the graph in memory and refresh it every N seconds.
"""
from __future__ import annotations

import asyncio
import math
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

from db import fetch_all, fetch_one
from config import (
    ROUTING_CROWD_REPORT_HOURS,
    ROUTING_CROWD_EDGE_BUFFER_M,
    ROUTING_CROWD_RECENCY_HALF_LIFE_HOURS,
    ROUTING_CROWD_MIN_RELIABILITY,
    ROUTING_CROWD_MAX_BOOST,
    ROUTING_SENSOR_FLOOD_RADIUS_M,
    ROUTING_SENSOR_FLOOD_DECAY,
    ROUTING_ENABLE_BIDIRECTIONAL,
    ROUTING_TRAFFIC_DEBUG_ENABLED,
    ROUTING_TRAFFIC_DEBUG_POINTS,
)

logger = logging.getLogger("graph_loader")

# ── Data structures ───────────────────────────────────────────────────────────

@dataclass(slots=True)
class Edge:
    edge_id: int
    to_node: int
    from_node: int
    length_m: float
    speed_limit_mps: float
    flood_depth_cm: float
    is_bidirectional: bool
    oneway: str | None = None
    highway: str | None = None
    junction: str | None = None
    motorcar_allowed: bool = True
    motorcycle_allowed: bool = True
    is_roundabout: bool = False
    source_is_reverse: bool = False


@dataclass(slots=True)
class NodePos:
    lng: float
    lat: float


@dataclass
class GraphSnapshot:
    """Immutable snapshot of the road graph."""
    # forward adjacency: node_id → list of outgoing edges
    adj_forward: dict[int, list[Edge]] = field(default_factory=dict)
    # backward adjacency (reversed edges): node_id → list of incoming edges (reversed)
    adj_backward: dict[int, list[Edge]] = field(default_factory=dict)
    # node positions
    node_pos: dict[int, NodePos] = field(default_factory=dict)
    # whether any edge has flood > 0
    has_any_flood: bool = False
    # node count / edge count for logging
    node_count: int = 0
    edge_count: int = 0


# ── SQL (mirrors routingRepository.js exactly) ────────────────────────────────

_EDGES_SQL_TEMPLATE = """
WITH crowd_recent AS (
    SELECT
        location,
        reliability_score,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 AS age_hours,
        CASE
            WHEN LOWER(TRIM(flood_level)) IN ('muc 1', 'mức 1', '1', 'nhẹ', 'nhe', 'light', 'mild') THEN 10
            WHEN LOWER(TRIM(flood_level)) IN ('muc 2', 'mức 2', '2') THEN 20
            WHEN LOWER(TRIM(flood_level)) IN ('muc 3', 'mức 3', '3', 'trung bình', 'trung binh', 'medium', 'moderate') THEN 30
            WHEN LOWER(TRIM(flood_level)) IN ('muc 4', 'mức 4', '4') THEN 40
            WHEN LOWER(TRIM(flood_level)) IN ('muc 5', 'mức 5', '5', 'nặng', 'nang', 'heavy', 'severe') THEN 55
            ELSE NULL
        END AS flood_cm
    FROM crowd_reports
    WHERE moderation_status = 'approved'
      AND COALESCE(reliability_score, 50) >= $4
      AND created_at >= NOW() - ($1::int * INTERVAL '1 hour')
),
crowd_weighted AS (
    SELECT
        location,
        flood_cm,
        LEAST(
            500.0,
            flood_cm
            * EXP(-(LN(2) * age_hours / GREATEST($3::double precision, 0.25)))
            * (0.6 + LEAST(100, GREATEST(0, COALESCE(reliability_score, 50))) / 100.0)
            * GREATEST($5::double precision, 1.0)
        ) AS weighted_flood_cm
    FROM crowd_recent
    WHERE flood_cm IS NOT NULL
),
crowd_edge AS (
    SELECT
        e.id AS edge_id,
        MAX(cw.weighted_flood_cm) AS crowd_flood_cm
    FROM road_edges e
    INNER JOIN crowd_weighted cw
        ON ST_DWithin(e.geom, cw.location, $2)
    WHERE e.is_active = TRUE
    GROUP BY e.id
)
SELECT
    e.id,
    e.from_node_id,
    e.to_node_id,
    e.length_m,
    e.speed_limit_mps,
    e.is_bidirectional,
    {traffic_select_sql},
    ST_X(fn.location::geometry) AS from_lng,
    ST_Y(fn.location::geometry) AS from_lat,
    ST_X(tn.location::geometry) AS to_lng,
    ST_Y(tn.location::geometry) AS to_lat,
    COALESCE(
        e.manual_flood_depth_cm,
        GREATEST(
            COALESCE(
                CASE
                    WHEN sens.status = 'offline' OR sens.is_active = FALSE THEN 0::double precision
                    WHEN sl.raw_wl IS NULL THEN 0::double precision
                    WHEN sens.coords IS NULL THEN sl.raw_wl::double precision
                    WHEN sl.dist_m IS NULL THEN sl.raw_wl::double precision
                    WHEN sl.dist_m >= $6::double precision THEN 0::double precision
                    WHEN $7::text = 'plateau' THEN sl.raw_wl::double precision
                    ELSE GREATEST(
                        0::double precision,
                        sl.raw_wl::double precision
                            * (1.0 - sl.dist_m / NULLIF($6::double precision, 0))
                    )
                END,
                0::double precision
            ),
            COALESCE(ce.crowd_flood_cm, 0)
        ),
        0
    ) AS flood_depth_cm
FROM road_edges e
INNER JOIN road_nodes fn ON fn.id = e.from_node_id
INNER JOIN road_nodes tn ON tn.id = e.to_node_id
LEFT JOIN sensors sens ON sens.sensor_id = e.flood_sensor_id
LEFT JOIN LATERAL (
    SELECT
        fl.water_level AS raw_wl,
        CASE
            WHEN sens.coords IS NULL THEN NULL::double precision
            ELSE ST_Distance(e.geom, sens.coords)
        END AS dist_m
    FROM flood_logs fl
    WHERE fl.sensor_id = e.flood_sensor_id
    ORDER BY fl.created_at DESC
    LIMIT 1
) sl ON true
LEFT JOIN crowd_edge ce ON ce.edge_id = e.id
WHERE e.is_active = TRUE
"""

_EDGE_COLUMNS_SQL = """
SELECT column_name
FROM information_schema.columns
WHERE table_schema = ANY (current_schemas(false))
  AND table_name = 'road_edges'
"""

_NEAREST_NODE_SQL = """
SELECT
    id,
    ST_X(location::geometry) AS lng,
    ST_Y(location::geometry) AS lat,
    ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    ) AS distance_m
FROM road_nodes
WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    $3
)
ORDER BY distance_m ASC
LIMIT 1
"""

_NEAREST_NODES_SQL = """
SELECT
    id,
    ST_X(location::geometry) AS lng,
    ST_Y(location::geometry) AS lat,
    ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    ) AS distance_m
FROM road_nodes
WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    $3
)
ORDER BY distance_m ASC
LIMIT $4
"""


def _build_graph_snapshot_from_rows(
    rows: list,
    ml_predictions: dict[int, float],
) -> GraphSnapshot:
    """
    CPU-heavy graph materialization (must not run on asyncio event loop).
    """
    snap = GraphSnapshot()
    has_flood = False

    for row in rows:
        from_id = int(row["from_node_id"])
        to_id = int(row["to_node_id"])

        from_lng = _safe_float(row["from_lng"])
        from_lat = _safe_float(row["from_lat"])
        to_lng = _safe_float(row["to_lng"])
        to_lat = _safe_float(row["to_lat"])
        length_m = _safe_float(row["length_m"])
        speed = _safe_float(row["speed_limit_mps"])
        db_flood = _safe_float(row["flood_depth_cm"]) or 0.0
        is_bidir = bool(row["is_bidirectional"])
        oneway = _normalize_text(row.get("oneway"))
        highway = _normalize_text(row.get("highway"))
        junction = _normalize_text(row.get("junction"))
        motorcar_allowed = _tag_allows_vehicle(row.get("motorcar"))
        motorcycle_allowed = _tag_allows_vehicle(row.get("motorcycle"))
        is_roundabout = junction == "roundabout"
        if is_roundabout and oneway not in {"yes", "1", "true", "-1"}:
            oneway = "yes"

        edge_id = int(row["id"])
        ml_depth = ml_predictions.get(edge_id, 0.0)
        flood = max(db_flood, ml_depth)

        if from_lng is None or from_lat is None or to_lng is None or to_lat is None:
            continue
        if length_m is None or length_m <= 0:
            continue

        speed = max(0.1, speed if speed else 0.1)

        if flood > 0:
            has_flood = True

        if from_id not in snap.node_pos:
            snap.node_pos[from_id] = NodePos(from_lng, from_lat)
        if to_id not in snap.node_pos:
            snap.node_pos[to_id] = NodePos(to_lng, to_lat)

        forward_allowed = _allows_forward(oneway)
        reverse_allowed = _allows_reverse(oneway, is_bidir)

        if forward_allowed:
            _add_directed_edge(
                snap=snap,
                edge=Edge(
                    edge_id=edge_id,
                    to_node=to_id,
                    from_node=from_id,
                    length_m=length_m,
                    speed_limit_mps=speed,
                    flood_depth_cm=flood,
                    is_bidirectional=is_bidir,
                    oneway=oneway,
                    highway=highway,
                    junction=junction,
                    motorcar_allowed=motorcar_allowed,
                    motorcycle_allowed=motorcycle_allowed,
                    is_roundabout=is_roundabout,
                    source_is_reverse=False,
                ),
            )

        if reverse_allowed:
            _add_directed_edge(
                snap=snap,
                edge=Edge(
                    edge_id=edge_id,
                    to_node=from_id,
                    from_node=to_id,
                    length_m=length_m,
                    speed_limit_mps=speed,
                    flood_depth_cm=flood,
                    is_bidirectional=is_bidir,
                    oneway=oneway,
                    highway=highway,
                    junction=junction,
                    motorcar_allowed=motorcar_allowed,
                    motorcycle_allowed=motorcycle_allowed,
                    is_roundabout=is_roundabout,
                    source_is_reverse=True,
                ),
            )

    snap.has_any_flood = has_flood
    snap.node_count = len(snap.node_pos)
    # edge_count is maintained incrementally in _add_directed_edge()
    return snap


# ── GraphCache ────────────────────────────────────────────────────────────────

class GraphCache:
    """
    Loads road_nodes + road_edges + flood data from DB and maintains an
    in-memory graph snapshot. Call ``refresh()`` periodically.
    """

    def __init__(self) -> None:
        self._snapshot: Optional[GraphSnapshot] = None
        self._lock = asyncio.Lock()
        self._edge_columns: set[str] | None = None

    async def _load_edge_columns(self) -> set[str]:
        if self._edge_columns is not None:
            return self._edge_columns
        rows = await fetch_all(_EDGE_COLUMNS_SQL)
        self._edge_columns = {str(r["column_name"]) for r in rows}
        return self._edge_columns

    async def _build_edges_sql(self) -> str:
        cols = await self._load_edge_columns()
        oneway_sql = "NULL::text AS oneway"
        if "oneway" in cols:
            oneway_sql = "NULLIF(TRIM(e.oneway::text), '') AS oneway"
        elif "osm_tags" in cols:
            oneway_sql = "NULLIF(TRIM(e.osm_tags->>'oneway'), '') AS oneway"

        highway_sql = "NULL::text AS highway"
        if "highway" in cols:
            highway_sql = "NULLIF(TRIM(e.highway::text), '') AS highway"
        elif "osm_tags" in cols:
            highway_sql = "NULLIF(TRIM(e.osm_tags->>'highway'), '') AS highway"

        junction_sql = "NULL::text AS junction"
        if "junction" in cols:
            junction_sql = "NULLIF(TRIM(e.junction::text), '') AS junction"
        elif "osm_tags" in cols:
            junction_sql = "NULLIF(TRIM(e.osm_tags->>'junction'), '') AS junction"

        motorcar_sql = "NULL::text AS motorcar"
        if "motorcar" in cols:
            motorcar_sql = "NULLIF(TRIM(e.motorcar::text), '') AS motorcar"
        elif "osm_tags" in cols:
            motorcar_sql = "NULLIF(TRIM(e.osm_tags->>'motorcar'), '') AS motorcar"

        motorcycle_sql = "NULL::text AS motorcycle"
        if "motorcycle" in cols:
            motorcycle_sql = "NULLIF(TRIM(e.motorcycle::text), '') AS motorcycle"
        elif "osm_tags" in cols:
            motorcycle_sql = "NULLIF(TRIM(e.osm_tags->>'motorcycle'), '') AS motorcycle"

        traffic_select_sql = ",\n    ".join(
            [oneway_sql, highway_sql, junction_sql, motorcar_sql, motorcycle_sql]
        )
        return _EDGES_SQL_TEMPLATE.format(traffic_select_sql=traffic_select_sql)

    @property
    def snapshot(self) -> GraphSnapshot | None:
        return self._snapshot

    async def refresh(self) -> GraphSnapshot:
        """Query DB and atomically swap the graph snapshot."""
        edges_sql = await self._build_edges_sql()
        rows = await fetch_all(
            edges_sql,
            ROUTING_CROWD_REPORT_HOURS,
            ROUTING_CROWD_EDGE_BUFFER_M,
            ROUTING_CROWD_RECENCY_HALF_LIFE_HOURS,
            ROUTING_CROWD_MIN_RELIABILITY,
            ROUTING_CROWD_MAX_BOOST,
            ROUTING_SENSOR_FLOOD_RADIUS_M,
            ROUTING_SENSOR_FLOOD_DECAY,
        )

        from services.ml_predictor import flood_predictor
        
        ml_predictions = {}
        if flood_predictor.is_available():
            try:
                # Fetch auxiliary data for ML inference
                sensors = await fetch_all('SELECT sensor_id, ST_X(coords::geometry) as lng, ST_Y(coords::geometry) as lat FROM sensors')
                flood_logs = await fetch_all('SELECT sensor_id, water_level FROM flood_logs ORDER BY created_at DESC LIMIT 1000')
                crowd_reports = await fetch_all("SELECT flood_level, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat FROM crowd_reports WHERE moderation_status = 'approved' ORDER BY created_at DESC LIMIT 500")
                
                # Format edges for ML predictor
                ml_edges = []
                for row in rows:
                    ml_edges.append({
                        'id': int(row['id']),
                        'speed_limit_mps': _safe_float(row['speed_limit_mps']),
                        'length_m': _safe_float(row['length_m']),
                        'from_lng': _safe_float(row['from_lng']),
                        'from_lat': _safe_float(row['from_lat'])
                    })
                
                logger.info("Running ML inference for %d edges...", len(ml_edges))
                ml_predictions = await asyncio.to_thread(
                    flood_predictor.predict_edge_depths,
                    ml_edges,
                    sensors,
                    flood_logs,
                    crowd_reports,
                )
            except Exception as e:
                logger.error("Failed to run ML predictor: %s", e)

        # Millions of edges: must not block asyncio (health checks + other requests would 502).
        snap = await asyncio.to_thread(_build_graph_snapshot_from_rows, rows, ml_predictions)

        # Atomic swap
        async with self._lock:
            self._snapshot = snap

        logger.info(
            "Graph refreshed: %d nodes, %d edges, flood=%s",
            snap.node_count,
            snap.edge_count,
            snap.has_any_flood,
        )
        _debug_log_traffic_points(snap)
        return snap

    async def get_nearest_node(
        self, lng: float, lat: float, max_dist_m: float
    ) -> dict | None:
        """
        Find the nearest road node to (lng, lat) within max_dist_m.
        Uses a DB query with PostGIS for accuracy.
        """
        row = await fetch_one(_NEAREST_NODE_SQL, lng, lat, max_dist_m)
        if row is None:
            return None
        return {
            "id": int(row["id"]),
            "lng": float(row["lng"]),
            "lat": float(row["lat"]),
            "distance_m": round(float(row["distance_m"]), 2),
        }

    async def get_nearest_nodes(
        self, lng: float, lat: float, max_dist_m: float, limit: int = 6
    ) -> list[dict]:
        rows = await fetch_all(_NEAREST_NODES_SQL, lng, lat, max_dist_m, max(1, min(limit, 20)))
        return [
            {
                "id": int(r["id"]),
                "lng": float(r["lng"]),
                "lat": float(r["lat"]),
                "distance_m": round(float(r["distance_m"]), 2),
            }
            for r in rows
        ]

    def get_nearest_node_inmemory(
        self, lng: float, lat: float, max_dist_m: float
    ) -> dict | None:
        """
        In-memory fallback using haversine. Faster but less accurate than PostGIS.
        """
        snap = self._snapshot
        if snap is None:
            return None

        best_id = None
        best_dist = float("inf")
        for node_id, pos in snap.node_pos.items():
            d = _haversine_meters(lng, lat, pos.lng, pos.lat)
            if d < best_dist:
                best_dist = d
                best_id = node_id

        if best_id is None or best_dist > max_dist_m:
            return None

        pos = snap.node_pos[best_id]
        return {
            "id": best_id,
            "lng": pos.lng,
            "lat": pos.lat,
            "distance_m": round(best_dist, 2),
        }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        return f if math.isfinite(f) else None
    except (ValueError, TypeError):
        return None


def _normalize_text(val) -> str | None:
    if val is None:
        return None
    raw = str(val).strip().lower()
    return raw or None


def _tag_allows_vehicle(val) -> bool:
    tag = _normalize_text(val)
    if tag in {None, "", "yes", "designated", "permissive", "unknown"}:
        return True
    if tag in {"1", "true"}:
        return True
    if tag in {"no", "0", "false", "private", "restricted"}:
        return False
    return True


def _allows_forward(oneway: str | None) -> bool:
    if oneway in {"yes", "1", "true"}:
        return True
    if oneway == "-1":
        return False
    return True


def _allows_reverse(oneway: str | None, is_bidir: bool) -> bool:
    if oneway in {"yes", "1", "true"}:
        return False
    if oneway == "-1":
        return True
    if oneway in {"no", "0", "false"}:
        return True
    return is_bidir


def _add_directed_edge(snap: GraphSnapshot, edge: Edge) -> None:
    snap.adj_forward.setdefault(edge.from_node, []).append(edge)
    snap.edge_count += 1
    if ROUTING_ENABLE_BIDIRECTIONAL:
        snap.adj_backward.setdefault(edge.to_node, []).append(
            Edge(
                edge_id=edge.edge_id,
                to_node=edge.from_node,
                from_node=edge.to_node,
                length_m=edge.length_m,
                speed_limit_mps=edge.speed_limit_mps,
                flood_depth_cm=edge.flood_depth_cm,
                is_bidirectional=edge.is_bidirectional,
                oneway=edge.oneway,
                highway=edge.highway,
                junction=edge.junction,
                motorcar_allowed=edge.motorcar_allowed,
                motorcycle_allowed=edge.motorcycle_allowed,
                is_roundabout=edge.is_roundabout,
                source_is_reverse=not edge.source_is_reverse,
            )
        )


def _parse_debug_points(raw: str) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    if not raw.strip():
        return points
    for chunk in raw.split(";"):
        pair = re.split(r"[,\s]+", chunk.strip())
        if len(pair) != 2:
            continue
        lng = _safe_float(pair[0])
        lat = _safe_float(pair[1])
        if lng is None or lat is None:
            continue
        points.append((lng, lat))
    return points


def _debug_log_traffic_points(snap: GraphSnapshot) -> None:
    if not ROUTING_TRAFFIC_DEBUG_ENABLED:
        return
    for lng, lat in _parse_debug_points(ROUTING_TRAFFIC_DEBUG_POINTS):
        nearest_id = None
        nearest_dist = float("inf")
        for node_id, pos in snap.node_pos.items():
            dist = _haversine_meters(lng, lat, pos.lng, pos.lat)
            if dist < nearest_dist:
                nearest_id = node_id
                nearest_dist = dist
        if nearest_id is None:
            continue
        edges = snap.adj_forward.get(nearest_id, [])
        logger.info(
            "Traffic debug node=%s dist_m=%.1f outgoing=%d",
            nearest_id,
            nearest_dist,
            len(edges),
        )
        for edge in edges[:8]:
            logger.info(
                "  edge=%s %s->%s oneway=%s highway=%s junction=%s motorcar=%s motorcycle=%s reverse=%s",
                edge.edge_id,
                edge.from_node,
                edge.to_node,
                edge.oneway,
                edge.highway,
                edge.junction,
                edge.motorcar_allowed,
                edge.motorcycle_allowed,
                edge.source_is_reverse,
            )


def _haversine_meters(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    R = 6_371_000
    to_rad = math.radians
    d_lat = to_rad(lat2 - lat1)
    d_lng = to_rad(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))


# Singleton
graph_cache = GraphCache()
