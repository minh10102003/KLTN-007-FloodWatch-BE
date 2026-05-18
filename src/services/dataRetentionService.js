const dataRetentionRepository = require('../repositories/dataRetentionRepository');

function readPositiveInt(envVal, fallback) {
    const n = parseInt(envVal, 10);
    if (Number.isNaN(n) || n < 1) return fallback;
    return n;
}

function isEnabled() {
    return String(process.env.DATA_RETENTION_ENABLED ?? 'true').toLowerCase() !== 'false';
}

function getConfig() {
    const sensorHours = readPositiveInt(
        process.env.SENSOR_LOG_RETENTION_HOURS || process.env.FLOOD_LOGS_RETENTION_HOURS,
        48
    );
    return {
        sensorHours,
        accessLogDays: readPositiveInt(process.env.ACCESS_LOGS_RETENTION_DAYS, 14),
        emergencySendLogHours: readPositiveInt(process.env.EMERGENCY_ALERT_SEND_LOG_RETENTION_HOURS, 168),
        intervalHours: readPositiveInt(process.env.DATA_RETENTION_INTERVAL_HOURS, 6),
        batchSize: readPositiveInt(process.env.DATA_RETENTION_BATCH_SIZE, 5000)
    };
}

let intervalHandle = null;
let running = false;

/**
 * Xóa log cũ một lần. Trả về số dòng đã xóa theo bảng.
 */
async function runRetentionOnce() {
    if (!isEnabled()) {
        return { skipped: true, reason: 'DATA_RETENTION_ENABLED=false' };
    }
    if (running) {
        return { skipped: true, reason: 'already_running' };
    }

    running = true;
    const cfg = getConfig();
    const started = Date.now();

    try {
        const flood_logs = await dataRetentionRepository.deleteOldFloodLogs(
            cfg.sensorHours,
            cfg.batchSize
        );
        const energy_logs = await dataRetentionRepository.deleteOldEnergyLogs(
            cfg.sensorHours,
            cfg.batchSize
        );
        const access_logs = await dataRetentionRepository.deleteOldAccessLogs(
            cfg.accessLogDays,
            cfg.batchSize
        );
        const emergency_alert_send_log =
            await dataRetentionRepository.deleteOldEmergencyAlertSendLog(
                cfg.emergencySendLogHours,
                cfg.batchSize
            );

        const summary = {
            retention_hours_sensor: cfg.sensorHours,
            flood_logs,
            energy_logs,
            access_logs_retention_days: cfg.accessLogDays,
            access_logs,
            emergency_alert_send_log,
            duration_ms: Date.now() - started
        };

        const total = flood_logs + energy_logs + access_logs + emergency_alert_send_log;
        if (total > 0) {
            console.log('[retention] Deleted old rows:', JSON.stringify(summary));
        } else {
            console.log('[retention] No rows to delete (sensor window %sh)', cfg.sensorHours);
        }

        return summary;
    } catch (err) {
        console.error('[retention] Error:', err.message);
        throw err;
    } finally {
        running = false;
    }
}

function startScheduledRetention() {
    if (!isEnabled()) {
        console.log('[retention] Disabled (DATA_RETENTION_ENABLED=false)');
        return;
    }

    const cfg = getConfig();
    const intervalMs = cfg.intervalHours * 60 * 60 * 1000;

    const tick = () => {
        runRetentionOnce().catch((err) => {
            console.error('[retention] Scheduled run failed:', err.message);
        });
    };

    setTimeout(tick, 60_000);
    intervalHandle = setInterval(tick, intervalMs);

    console.log(
        `[retention] Scheduled every ${cfg.intervalHours}h — keep sensor logs ${cfg.sensorHours}h (flood_logs + energy_logs)`
    );
}

function stopScheduledRetention() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
}

module.exports = {
    runRetentionOnce,
    startScheduledRetention,
    stopScheduledRetention,
    getConfig,
    isEnabled
};
