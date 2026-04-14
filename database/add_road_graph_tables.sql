-- Road graph cho AMC-A* routing
CREATE TABLE IF NOT EXISTS road_nodes (
    id BIGSERIAL PRIMARY KEY,
    node_key VARCHAR(100) UNIQUE,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS road_edges (
    id BIGSERIAL PRIMARY KEY,
    from_node_id BIGINT NOT NULL REFERENCES road_nodes(id) ON DELETE CASCADE,
    to_node_id BIGINT NOT NULL REFERENCES road_nodes(id) ON DELETE CASCADE,
    geom GEOGRAPHY(LineString, 4326) NOT NULL,
    length_m DOUBLE PRECISION NOT NULL CHECK (length_m > 0),
    speed_limit_mps DOUBLE PRECISION NOT NULL CHECK (speed_limit_mps > 0),
    is_bidirectional BOOLEAN NOT NULL DEFAULT TRUE,
    flood_sensor_id VARCHAR(50) REFERENCES sensors(sensor_id) ON DELETE SET NULL,
    manual_flood_depth_cm DOUBLE PRECISION,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_road_nodes_location ON road_nodes USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_road_edges_geom ON road_edges USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_road_edges_from_to ON road_edges(from_node_id, to_node_id);
CREATE INDEX IF NOT EXISTS idx_road_edges_active ON road_edges(is_active);

COMMENT ON TABLE road_nodes IS 'Nút giao thông cho thuật toán AMC-A*';
COMMENT ON TABLE road_edges IS 'Cạnh giao thông cho AMC-A* (chiều dài, tốc độ, liên kết sensor ngập)';
