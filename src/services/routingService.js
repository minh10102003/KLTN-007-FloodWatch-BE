/**
 * routingService.js — Thin HTTP client that delegates routing to the Python FastAPI service.
 *
 * Falls back to legacy Node.js A* if Python service is unavailable.
 */

const PYTHON_ROUTING_URL = process.env.PYTHON_ROUTING_URL || 'http://localhost:8001';

function readPositiveIntEnv(name, fallback) {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Gọi Python /safe-path: graph lớn + A* có thể >10s; quá ngắn sẽ abort rồi fallback Node (rất chậm) → client hay bị 15s timeout. */
const PYTHON_ROUTING_FETCH_TIMEOUT_MS = readPositiveIntEnv('PYTHON_ROUTING_FETCH_TIMEOUT_MS', 120_000);
const PYTHON_ROUTING_HEALTH_TIMEOUT_MS = readPositiveIntEnv('PYTHON_ROUTING_HEALTH_TIMEOUT_MS', 5_000);

/** Trên production đồ thị lớn (~M edges), fallback A* legacy trong Node dễ OOM / treo > proxy Railway → 502. Đặt false để chỉ dùng Python và trả 503 rõ ràng khi Python lỗi. */
const ROUTING_LEGACY_FALLBACK = String(process.env.ROUTING_LEGACY_FALLBACK || 'true').toLowerCase() !== 'false';

// ── Legacy A* (fallback) ─────────────────────────────────────────────────────
const routingRepository = require('../repositories/routingRepository');

const VEHICLE_PROFILES = {
    motorbike: { name: 'Xe máy', maxWadingDepthCm: 20 },
    car: { name: 'Ô tô con', maxWadingDepthCm: 30 },
    suv: { name: 'SUV', maxWadingDepthCm: 50 }
};

function toFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function parseIntInRange(value, defaultValue, min, max) {
    const parsed = parseInt(value, 10);
    const base = Number.isNaN(parsed) ? defaultValue : parsed;
    const clamped = Math.max(min, Math.min(max, base));
    return clamped;
}

function parseFloatInRange(value, defaultValue, min, max) {
    const parsed = Number(value);
    const base = Number.isFinite(parsed) ? parsed : defaultValue;
    const clamped = Math.max(min, Math.min(max, base));
    return clamped;
}

function floodPenalty(depthCm, maxWadingDepthCm) {
    const d = Number(depthCm) || 0;
    if (d <= 0) return 1.0;
    if (d <= 0.5 * maxWadingDepthCm) return 1.5;
    if (d <= maxWadingDepthCm) return 5.0;
    return Number.POSITIVE_INFINITY;
}

function haversineMeters(a, b) {
    const R = 6371000;
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
}

function reconstructPath(cameFrom, current) {
    const path = [current];
    while (cameFrom.has(current)) {
        current = cameFrom.get(current);
        path.push(current);
    }
    return path.reverse();
}

function parseVehicleType(vehicleType) {
    const key = String(vehicleType || 'motorbike').trim().toLowerCase();
    return VEHICLE_PROFILES[key] || null;
}

function adjacencyFromEdges(edges) {
    const adj = new Map();
    const nodePos = new Map();

    function addNode(id, lng, lat) {
        if (!nodePos.has(id)) nodePos.set(id, { lng, lat });
    }

    function addEdge(from, to, edge) {
        if (!adj.has(from)) adj.set(from, []);
        adj.get(from).push(edge);
    }

    for (const e of edges) {
        const from = Number(e.from_node_id);
        const to = Number(e.to_node_id);

        if (!Number.isInteger(from) || !Number.isInteger(to)) {
            continue;
        }

        const fromLng = toFiniteNumber(e.from_lng);
        const fromLat = toFiniteNumber(e.from_lat);
        const toLng = toFiniteNumber(e.to_lng);
        const toLat = toFiniteNumber(e.to_lat);
        const lengthM = toFiniteNumber(e.length_m);
        const speedLimit = toFiniteNumber(e.speed_limit_mps);
        const floodDepth = toFiniteNumber(e.flood_depth_cm) ?? 0;

        if (fromLng == null || fromLat == null || toLng == null || toLat == null) {
            continue;
        }
        if (lengthM == null || lengthM <= 0) {
            continue;
        }

        const speedLimitMps = Math.max(0.1, speedLimit ?? 0.1);

        addNode(from, fromLng, fromLat);
        addNode(to, toLng, toLat);

        addEdge(from, to, {
            edgeId: Number(e.id),
            to,
            lengthM,
            speedLimitMps,
            floodDepthCm: floodDepth
        });
        if (e.is_bidirectional) {
            addEdge(to, from, {
                edgeId: Number(e.id),
                to: from,
                lengthM,
                speedLimitMps,
                floodDepthCm: floodDepth
            });
        }
    }
    return { adj, nodePos };
}

function aStar({ startNodeId, targetNodeId, adj, nodePos, vehicle, isDryNetwork }) {
    const open = new Set([startNodeId]);
    const cameFrom = new Map();
    const cameByEdge = new Map();
    const gScore = new Map();
    const fScore = new Map();
    const blockedEdgeIds = new Set();
    const nearLimitEdgeIds = new Set();
    const maxSpeed = (() => {
        if (isDryNetwork) return 1; // không dùng trong chế độ shortest path
        let s = 0;
        for (const list of adj.values()) {
            for (const e of list) s = Math.max(s, e.speedLimitMps);
        }
        return Math.max(0.1, s);
    })();

    function heuristic(nodeId) {
        const p1 = nodePos.get(nodeId);
        const p2 = nodePos.get(targetNodeId);
        if (!p1 || !p2) return 0;
        const dist = haversineMeters({ lng: p1.lng, lat: p1.lat }, { lng: p2.lng, lat: p2.lat });
        return isDryNetwork ? dist : dist / maxSpeed;
    }

    function popLowestFScore() {
        let best = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const id of open) {
            const score = fScore.get(id) ?? Number.POSITIVE_INFINITY;
            if (score < bestScore) {
                best = id;
                bestScore = score;
            }
        }
        return best;
    }

    gScore.set(startNodeId, 0);
    fScore.set(startNodeId, heuristic(startNodeId));

    while (open.size > 0) {
        const current = popLowestFScore();
        if (current == null) break;
        if (current === targetNodeId) {
            return {
                nodePath: reconstructPath(cameFrom, current),
                cameByEdge,
                blockedEdgeIds: Array.from(blockedEdgeIds),
                nearLimitEdgeIds: Array.from(nearLimitEdgeIds),
                totalCostSec: gScore.get(current) || 0
            };
        }
        open.delete(current);

        const neighbors = adj.get(current) || [];
        for (const edge of neighbors) {
            let edgeCost;

            if (isDryNetwork) {
                // Không có ngập ở bất cứ đâu: tối ưu quãng đường (m).
                edgeCost = edge.lengthM;
            } else {
                const penalty = floodPenalty(edge.floodDepthCm, vehicle.maxWadingDepthCm);
                if (!Number.isFinite(penalty)) {
                    blockedEdgeIds.add(edge.edgeId);
                    continue;
                }
                if (penalty >= 5) nearLimitEdgeIds.add(edge.edgeId);

                const travelSec = edge.lengthM / edge.speedLimitMps;
                edgeCost = travelSec * penalty;
            }

            const tentative = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + edgeCost;
            if (tentative < (gScore.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
                cameFrom.set(edge.to, current);
                cameByEdge.set(edge.to, edge);
                gScore.set(edge.to, tentative);
                fScore.set(edge.to, tentative + heuristic(edge.to));
                open.add(edge.to);
            }
        }
    }

    return null;
}

function buildSegmentOutput(nodePath, nodePos, cameByEdge) {
    const segments = [];
    let totalLengthM = 0;
    let totalTimeSec = 0;
    for (let i = 1; i < nodePath.length; i++) {
        const toNodeId = nodePath[i];
        const fromNodeId = nodePath[i - 1];
        const edge = cameByEdge.get(toNodeId);
        if (!edge) continue;
        const fromPos = nodePos.get(fromNodeId);
        const toPos = nodePos.get(toNodeId);
        totalLengthM += edge.lengthM;
        totalTimeSec += edge.lengthM / edge.speedLimitMps;
        segments.push({
            edge_id: edge.edgeId,
            from_node_id: fromNodeId,
            to_node_id: toNodeId,
            length_m: Number(edge.lengthM.toFixed(2)),
            speed_limit_mps: edge.speedLimitMps,
            flood_depth_cm: Number(edge.floodDepthCm.toFixed(2)),
            from: fromPos ? { lng: fromPos.lng, lat: fromPos.lat } : null,
            to: toPos ? { lng: toPos.lng, lat: toPos.lat } : null
        });
    }
    return { segments, totalLengthM, totalTimeSec };
}

// ── Legacy A* implementation (used as fallback) ──────────────────────────────
async function findSafePathLegacy({ start_lng, start_lat, end_lng, end_lat, vehicle_type, nearest_node_max_m }) {
    const vehicle = parseVehicleType(vehicle_type);
    if (!vehicle) {
        const allow = Object.keys(VEHICLE_PROFILES).join(', ');
        throw new Error(`vehicle_type không hợp lệ. Cho phép: ${allow}`);
    }
    const startLng = toFiniteNumber(start_lng);
    const startLat = toFiniteNumber(start_lat);
    const endLng = toFiniteNumber(end_lng);
    const endLat = toFiniteNumber(end_lat);

    if (startLng == null || startLat == null || endLng == null || endLat == null) {
        throw new Error('Tọa độ start/end không hợp lệ.');
    }

    const maxNearest = parseIntInRange(
        nearest_node_max_m ?? process.env.ROUTING_NEAREST_NODE_MAX_M,
        1200, 150, 5000
    );

    const crowdHours = parseIntInRange(process.env.ROUTING_CROWD_REPORT_HOURS, 6, 1, 72);
    const crowdBufferM = parseIntInRange(process.env.ROUTING_CROWD_EDGE_BUFFER_M, 35, 5, 200);
    const crowdHalfLifeHours = parseIntInRange(process.env.ROUTING_CROWD_RECENCY_HALF_LIFE_HOURS, 2, 1, 24);
    const crowdMinReliability = parseIntInRange(process.env.ROUTING_CROWD_MIN_RELIABILITY, 40, 0, 100);
    const crowdMaxBoost = parseFloatInRange(process.env.ROUTING_CROWD_MAX_BOOST, 1.5, 1, 3);
    const sensorFloodRadiusM = parseIntInRange(process.env.ROUTING_SENSOR_FLOOD_RADIUS_M, 120, 30, 500);
    const rawSensorDecay = String(process.env.ROUTING_SENSOR_FLOOD_DECAY || 'linear').trim().toLowerCase();
    const sensorFloodDecay = rawSensorDecay === 'plateau' ? 'plateau' : 'linear';

    const [startNode, endNode, edges] = await Promise.all([
        routingRepository.getNearestNode({ lng: startLng, lat: startLat, maxDistanceMeters: maxNearest }),
        routingRepository.getNearestNode({ lng: endLng, lat: endLat, maxDistanceMeters: maxNearest }),
        routingRepository.getActiveEdgesWithFloodDepth({
            crowdHours, crowdBufferM, crowdHalfLifeHours,
            crowdMinReliability, crowdMaxBoost, sensorFloodRadiusM, sensorFloodDecay
        })
    ]);

    if (!startNode || !endNode) {
        throw new Error('Không tìm thấy road node gần điểm đầu/cuối. Cần nạp dữ liệu road_nodes.');
    }
    if (!edges.length) {
        throw new Error('Chưa có road_edges. Hãy import mạng đường để chạy AMC-A*.');
    }

    const { adj, nodePos } = adjacencyFromEdges(edges);
    const startNodeId = Number(startNode.id);
    const endNodeId = Number(endNode.id);
    if (!adj.has(startNodeId) || !adj.has(endNodeId)) {
        throw new Error('Start/End node không nằm trong đồ thị đường đang active.');
    }

    const hasAnyFlood = edges.some((e) => Number(e.flood_depth_cm) > 0);

    const result = aStar({
        startNodeId,
        targetNodeId: endNodeId,
        adj, nodePos, vehicle,
        isDryNetwork: !hasAnyFlood
    });

    if (!result) {
        return {
            found: false,
            reason: 'Không tìm thấy đường đi an toàn (có thể tất cả nhánh bị ngập quá ngưỡng xe).',
            vehicle, start_node: startNode, end_node: endNode
        };
    }

    const { segments, totalLengthM, totalTimeSec } = buildSegmentOutput(result.nodePath, nodePos, result.cameByEdge);
    return {
        found: true, vehicle,
        flood_sources: {
            crowd_report_hours: crowdHours, crowd_edge_buffer_m: crowdBufferM,
            crowd_recency_half_life_hours: crowdHalfLifeHours,
            crowd_min_reliability: crowdMinReliability,
            crowd_max_boost: crowdMaxBoost,
            sensor_flood_radius_m: sensorFloodRadiusM,
            sensor_flood_decay: sensorFloodDecay
        },
        start_node: startNode, end_node: endNode,
        node_path: result.nodePath,
        route: {
            total_cost_sec: Number(totalTimeSec.toFixed(2)),
            total_distance_m: Number(totalLengthM.toFixed(2)),
            segments
        },
        avoided: {
            blocked_edge_ids: result.blockedEdgeIds,
            near_limit_edge_ids: result.nearLimitEdgeIds
        }
    };
}

// ── Python service health check ──────────────────────────────────────────────
let _pythonServiceAvailable = null; // null = not checked, true/false
let _lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL_MS = 30_000; // re-check every 30s

async function isPythonServiceAvailable() {
    const now = Date.now();
    if (_pythonServiceAvailable !== null && (now - _lastHealthCheck) < HEALTH_CHECK_INTERVAL_MS) {
        return _pythonServiceAvailable;
    }
    try {
        const response = await fetch(`${PYTHON_ROUTING_URL}/health`, {
            signal: AbortSignal.timeout(PYTHON_ROUTING_HEALTH_TIMEOUT_MS)
        });
        _pythonServiceAvailable = response.ok;
    } catch {
        _pythonServiceAvailable = false;
    }
    _lastHealthCheck = now;
    return _pythonServiceAvailable;
}

// ── Primary: call Python service via HTTP ────────────────────────────────────
async function findSafePathViaPython({ start_lng, start_lat, end_lng, end_lat, vehicle_type, nearest_node_max_m }) {
    const url = new URL('/api/v1/routing/safe-path', PYTHON_ROUTING_URL);
    url.searchParams.set('start_lng', start_lng);
    url.searchParams.set('start_lat', start_lat);
    url.searchParams.set('end_lng', end_lng);
    url.searchParams.set('end_lat', end_lat);
    url.searchParams.set('vehicle_type', vehicle_type || 'motorbike');
    if (nearest_node_max_m != null) {
        url.searchParams.set('nearest_node_max_m', nearest_node_max_m);
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(PYTHON_ROUTING_FETCH_TIMEOUT_MS) });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Python routing error: ${response.status}`);
    }
    const json = await response.json();
    return json.data;
}

// ── Public API with fallback ─────────────────────────────────────────────────
const routingService = {
    async findSafePath(params) {
        // Try Python service first
        const pythonUp = await isPythonServiceAvailable();
        if (pythonUp) {
            try {
                return await findSafePathViaPython(params);
            } catch (err) {
                console.warn('[routing] Python service failed, falling back to Node.js A*:', err.message);
                // Reset cache so we re-check next time
                _pythonServiceAvailable = null;
                if (!ROUTING_LEGACY_FALLBACK) {
                    throw new Error(
                        `service unavailable: Python routing lỗi (${err.message}). Đặt ROUTING_LEGACY_FALLBACK=true tạm thời nếu cần fallback Node (không khuyến nghị với đồ thị lớn).`
                    );
                }
            }
        } else if (!ROUTING_LEGACY_FALLBACK) {
            throw new Error(
                'service unavailable: Python routing không khả dụng (health check fail) và ROUTING_LEGACY_FALLBACK=false.'
            );
        }

        // Fallback to legacy Node.js A*
        return findSafePathLegacy(params);
    }
};

module.exports = routingService;