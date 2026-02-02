const BaseRepository = require('./baseRepository');

/**
 * Energy Repository
 * Chứa tất cả các query liên quan đến theo dõi năng lượng
 */
class EnergyRepository extends BaseRepository {
    /**
     * Tạo energy log mới
     * @param {Object} energyData - Dữ liệu năng lượng
     */
    async createEnergyLog(energyData) {
        const {
            sensor_id,
            voltage,
            current,
            power,
            battery_level,
            power_source
        } = energyData;

        const query = `
            INSERT INTO energy_logs (sensor_id, voltage, current, power, battery_level, power_source)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        return await this.queryOne(query, [sensor_id, voltage, current, power, battery_level, power_source]);
    }

    /**
     * Lấy energy logs theo sensor
     * @param {string} sensorId - Sensor ID
     * @param {number} limit - Số lượng tối đa
     */
    async getEnergyLogsBySensor(sensorId, limit = 100) {
        const query = `
            SELECT *
            FROM energy_logs
            WHERE sensor_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `;
        return await this.queryAll(query, [sensorId, limit]);
    }

    /**
     * Lấy energy log mới nhất của sensor
     * @param {string} sensorId - Sensor ID
     */
    async getLatestEnergyLog(sensorId) {
        const query = `
            SELECT *
            FROM energy_logs
            WHERE sensor_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `;
        return await this.queryOne(query, [sensorId]);
    }

    /**
     * Cập nhật battery level và power source của sensor
     * @param {string} sensorId - Sensor ID
     * @param {number} batteryLevel - Mức pin (%)
     * @param {string} powerSource - Nguồn điện
     */
    async updateSensorEnergy(sensorId, batteryLevel, powerSource) {
        const query = `
            UPDATE sensors 
            SET battery_level = $1, power_source = $2
            WHERE sensor_id = $3
            RETURNING sensor_id, battery_level, power_source
        `;
        return await this.queryOne(query, [batteryLevel, powerSource, sensorId]);
    }

    /**
     * Lấy thống kê năng lượng theo sensor
     * @param {string} sensorId - Sensor ID
     * @param {number} hours - Số giờ gần đây
     */
    async getEnergyStats(sensorId, hours = 24) {
        const query = `
            SELECT 
                AVG(voltage) as avg_voltage,
                AVG(current) as avg_current,
                AVG(power) as avg_power,
                MIN(battery_level) as min_battery,
                MAX(battery_level) as max_battery,
                AVG(battery_level) as avg_battery,
                COUNT(*) as total_logs
            FROM energy_logs
            WHERE sensor_id = $1
            AND created_at >= NOW() - INTERVAL '${hours} hours'
        `;
        return await this.queryOne(query, [sensorId]);
    }

    /**
     * Lấy sensors có mức pin thấp
     * @param {number} threshold - Ngưỡng mức pin (%)
     */
    async getLowBatterySensors(threshold = 20) {
        const query = `
            SELECT 
                s.sensor_id,
                s.location_name,
                s.battery_level,
                s.power_source,
                e.voltage,
                e.current,
                e.power,
                e.created_at as last_energy_log
            FROM sensors s
            LEFT JOIN LATERAL (
                SELECT voltage, current, power, created_at
                FROM energy_logs
                WHERE sensor_id = s.sensor_id
                ORDER BY created_at DESC
                LIMIT 1
            ) e ON true
            WHERE s.battery_level IS NOT NULL
            AND s.battery_level <= $1
            AND s.is_active = TRUE
            ORDER BY s.battery_level ASC
        `;
        return await this.queryAll(query, [threshold]);
    }
}

module.exports = new EnergyRepository();

