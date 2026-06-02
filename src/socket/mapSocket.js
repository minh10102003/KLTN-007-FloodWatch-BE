const floodRepository = require('../repositories/floodRepository');
const crowdReportRepository = require('../repositories/crowdReportRepository');

let mapNamespace = null;
let broadcastTimer = null;

function mapSensorRow(row) {
    return {
        sensor_id: row.sensor_id,
        location_name: row.location_name,
        status: row.log_status || row.sensor_status || 'normal',
        water_level: row.water_level != null ? Number(row.water_level) : null,
        lat: row.lat != null ? Number(row.lat) : null,
        lng: row.lng != null ? Number(row.lng) : null,
        updated_at: row.created_at || row.last_data_time || null
    };
}

function mapReportRow(row) {
    return {
        id: row.id,
        flood_level: row.flood_level,
        validation_status: row.validation_status,
        moderation_status: row.moderation_status,
        lat: row.lat != null ? Number(row.lat) : null,
        lng: row.lng != null ? Number(row.lng) : null,
        created_at: row.created_at || null
    };
}

async function buildMapSnapshot() {
    const [sensorRows, reportRows] = await Promise.all([
        floodRepository.getRealTimeFloodData(),
        crowdReportRepository.getRecentReports(24, 'approved')
    ]);
    const sensors = sensorRows.map(mapSensorRow);
    const reports = reportRows.map(mapReportRow);
    return {
        sensors,
        reports,
        data: { sensors, reports }
    };
}

async function emitMapSnapshot(reason = 'update') {
    if (!mapNamespace) return;
    const payload = await buildMapSnapshot();
    mapNamespace.emit('map:update', {
        reason,
        ...payload,
        emitted_at: new Date().toISOString()
    });
}

function emitMapUpdate(reason = 'update') {
    if (!mapNamespace) return;
    if (broadcastTimer) return;
    broadcastTimer = setTimeout(async () => {
        broadcastTimer = null;
        try {
            await emitMapSnapshot(reason);
        } catch (err) {
            console.error('[socket] map:update error:', err.message);
        }
    }, 300);
}

function initMapSocket(io) {
    mapNamespace = io.of('/ws/map');
    mapNamespace.on('connection', (socket) => {
        emitMapSnapshot('initial').catch((err) => {
            console.error('[socket] map initial snapshot error:', err.message);
        });
        socket.on('disconnect', () => {});
    });
}

module.exports = {
    initMapSocket,
    emitMapUpdate,
    emitMapSnapshot
};
