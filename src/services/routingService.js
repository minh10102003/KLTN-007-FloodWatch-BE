const routingRepository = require('../repositories/routingRepository');

const VEHICLE_PROFILES = {
    motorbike: { name: 'Xe máy', maxWadingDepthCm: 20 },
    car: { name: 'Ô tô con', maxWadingDepthCm: 30 },
    suv: { name: 'SUV', maxWadingDepthCm: 50 }
};

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
        if (!nodePos.has(id)) nodePos.set(id, { lng: Number(lng), lat: Number(lat) });
    }

    function addEdge(from, to, edge) {
        if (!adj.has(from)) adj.set(from, []);
        adj.get(from).push(edge);
    }

    for (const e of edges) {
        const from = Number(e.from_node_id);
        const to = Number(e.to_node_id);
        addNode(from, e.from_lng, e.from_lat);
        addNode(to, e.to_lng, e.to_lat);

        addEdge(from, to, {
            edgeId: Number(e.id),
            to,
            lengthM: Number(e.length_m),
            speedLimitMps: Math.max(0.1, Number(e.speed_limit_mps)),
            floodDepthCm: Number(e.flood_depth_cm) || 0
        });
        if (e.is_bidirectional) {
            addEdge(to, from, {
                edgeId: Number(e.id),
                to: from,
                lengthM: Number(e.length_m),
                speedLimitMps: Math.max(0.1, Number(e.speed_limit_mps)),
                floodDepthCm: Number(e.flood_depth_cm) || 0
            });
        }
    }
    return { adj, nodePos };
}

function aStar({ startNodeId, targetNodeId, adj, nodePos, vehicle }) {
    const open = new Set([startNodeId]);
    const cameFrom = new Map();
    const cameByEdge = new Map();
    const gScore = new Map();
    const fScore = new Map();
    const blockedEdgeIds = new Set();
    const nearLimitEdgeIds = new Set();
    const maxSpeed = (() => {
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
        return haversineMeters({ lng: p1.lng, lat: p1.lat }, { lng: p2.lng, lat: p2.lat }) / maxSpeed;
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
            const penalty = floodPenalty(edge.floodDepthCm, vehicle.maxWadingDepthCm);
            if (!Number.isFinite(penalty)) {
                blockedEdgeIds.add(edge.edgeId);
                continue;
            }
            if (penalty >= 5) nearLimitEdgeIds.add(edge.edgeId);

            const travelSec = edge.lengthM / edge.speedLimitMps;
            const tentative = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + travelSec * penalty;
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
    for (let i = 1; i < nodePath.length; i++) {
        const toNodeId = nodePath[i];
        const fromNodeId = nodePath[i - 1];
        const edge = cameByEdge.get(toNodeId);
        if (!edge) continue;
        const fromPos = nodePos.get(fromNodeId);
        const toPos = nodePos.get(toNodeId);
        totalLengthM += edge.lengthM;
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
    return { segments, totalLengthM };
}

const routingService = {
    async findSafePath({ start_lng, start_lat, end_lng, end_lat, vehicle_type, nearest_node_max_m }) {
        const vehicle = parseVehicleType(vehicle_type);
        if (!vehicle) {
            const allow = Object.keys(VEHICLE_PROFILES).join(', ');
            throw new Error(`vehicle_type không hợp lệ. Cho phép: ${allow}`);
        }

        const maxNearest = Math.min(
            5000,
            Math.max(150, parseInt(nearest_node_max_m || process.env.ROUTING_NEAREST_NODE_MAX_M || '1200', 10))
        );

        const [startNode, endNode, edges] = await Promise.all([
            routingRepository.getNearestNode({ lng: Number(start_lng), lat: Number(start_lat), maxDistanceMeters: maxNearest }),
            routingRepository.getNearestNode({ lng: Number(end_lng), lat: Number(end_lat), maxDistanceMeters: maxNearest }),
            routingRepository.getActiveEdgesWithFloodDepth()
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

        const result = aStar({
            startNodeId,
            targetNodeId: endNodeId,
            adj,
            nodePos,
            vehicle
        });

        if (!result) {
            return {
                found: false,
                reason: 'Không tìm thấy đường đi an toàn (có thể tất cả nhánh bị ngập quá ngưỡng xe).',
                vehicle,
                start_node: startNode,
                end_node: endNode
            };
        }

        const { segments, totalLengthM } = buildSegmentOutput(result.nodePath, nodePos, result.cameByEdge);
        return {
            found: true,
            vehicle,
            start_node: startNode,
            end_node: endNode,
            node_path: result.nodePath,
            route: {
                total_cost_sec: Number(result.totalCostSec.toFixed(2)),
                total_distance_m: Number(totalLengthM.toFixed(2)),
                segments
            },
            avoided: {
                blocked_edge_ids: result.blockedEdgeIds,
                near_limit_edge_ids: result.nearLimitEdgeIds
            }
        };
    }
};

module.exports = routingService;
