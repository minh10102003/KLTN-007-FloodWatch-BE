const BaseRepository = require('./baseRepository');
const sensorRepository = require('./sensorRepository');
const userRepository = require('./userRepository');

/**
 * Crowd Report Repository
 * Chứa tất cả các query liên quan đến crowd_reports
 */
class CrowdReportRepository extends BaseRepository {
    /**
     * Lấy các báo cáo từ người dân trong vòng 24 giờ qua
     */
    async getRecentReports(hours = 24, moderationStatus = null, validationStatus = null) {
        let query = `
            SELECT 
                id,
                reporter_name,
                reporter_id,
                flood_level,
                reliability_score,
                validation_status,
                verified_by_sensor,
                photo_url,
                moderation_status,
                moderated_by,
                moderated_at,
                rejection_reason,
                ST_X(location::geometry) as lng, 
                ST_Y(location::geometry) as lat, 
                created_at 
            FROM crowd_reports 
            WHERE created_at > NOW() - INTERVAL '${hours} hours'
        `;
        const params = [];
        let paramIndex = 1;

        if (moderationStatus) {
            query += ` AND moderation_status = $${paramIndex++}`;
            params.push(moderationStatus);
        }

        if (validationStatus) {
            query += ` AND validation_status = $${paramIndex++}`;
            params.push(validationStatus);
        }

        query += ` ORDER BY created_at DESC`;
        return await this.queryAll(query, params);
    }

    /**
     * Lấy tất cả báo cáo (không giới hạn thời gian)
     * @param {number} limit - Số lượng bản ghi tối đa
     * @param {string} moderationStatus - Trạng thái kiểm duyệt
     */
    async getAllReports(limit = 100, moderationStatus = null) {
        let query = `
            SELECT 
                id,
                reporter_name,
                reporter_id,
                flood_level,
                reliability_score,
                validation_status,
                verified_by_sensor,
                photo_url,
                moderation_status,
                moderated_by,
                moderated_at,
                rejection_reason,
                ST_X(location::geometry) as lng, 
                ST_Y(location::geometry) as lat, 
                created_at 
            FROM crowd_reports 
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (moderationStatus) {
            query += ` AND moderation_status = $${paramIndex++}`;
            params.push(moderationStatus);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
        params.push(limit);

        return await this.queryAll(query, params);
    }

    /**
     * Thống kê báo cáo theo giờ hoặc ngày (cho Moderator/Admin)
     * @param {string} groupBy - 'hour' | 'day'
     * @param {Date|string} from - Từ ngày (ISO string hoặc Date)
     * @param {Date|string} to - Đến ngày (ISO string hoặc Date)
     */
    async getReportStatsByPeriod(groupBy = 'day', from = null, to = null) {
        const toDate = to ? new Date(to) : new Date();
        const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const trunc = groupBy === 'hour' ? 'hour' : 'day';
        const query = `
            SELECT 
                date_trunc($1, created_at AT TIME ZONE 'UTC') AS period,
                COUNT(*)::int AS count
            FROM crowd_reports
            WHERE created_at >= $2 AND created_at <= $3
            GROUP BY date_trunc($1, created_at AT TIME ZONE 'UTC')
            ORDER BY period
        `;
        return await this.queryAll(query, [trunc, fromDate.toISOString(), toDate.toISOString()]);
    }

    /**
     * Lấy báo cáo theo ID
     * @param {number} reportId - Report ID
     */
    async getReportById(reportId) {
        const query = `
            SELECT 
                id,
                reporter_name,
                reporter_id,
                flood_level,
                reliability_score,
                validation_status,
                verified_by_sensor,
                photo_url,
                moderation_status,
                moderated_by,
                moderated_at,
                rejection_reason,
                ST_X(location::geometry) as lng, 
                ST_Y(location::geometry) as lat, 
                created_at
            FROM crowd_reports
            WHERE id = $1
        `;
        return await this.queryOne(query, [reportId]);
    }

    /**
     * Kiểm duyệt báo cáo (approve/reject)
     * @param {number} reportId - Report ID
     * @param {string} moderationStatus - 'approved' hoặc 'rejected'
     * @param {number} moderatorId - User ID của người kiểm duyệt
     * @param {string} rejectionReason - Lý do từ chối (nếu reject)
     */
    async moderateReport(reportId, moderationStatus, moderatorId, rejectionReason = null) {
        const query = `
            UPDATE crowd_reports
            SET moderation_status = $1,
                moderated_by = $2,
                moderated_at = CURRENT_TIMESTAMP,
                rejection_reason = $3
            WHERE id = $4
            RETURNING *
        `;
        const result = await this.queryOne(query, [moderationStatus, moderatorId, rejectionReason, reportId]);
        
        if (!result) {
            throw new Error(`Không tìm thấy báo cáo với ID: ${reportId}`);
        }
        
        return result;
    }

    /**
     * Cập nhật photo_url cho report
     * @param {number} reportId - Report ID
     * @param {string} photoUrl - URL của ảnh
     */
    async updateReportPhoto(reportId, photoUrl) {
        const query = `
            UPDATE crowd_reports
            SET photo_url = $1
            WHERE id = $2
            RETURNING *
        `;
        return await this.queryOne(query, [photoUrl, reportId]);
    }

    /**
     * Lấy báo cáo cần kiểm duyệt
     * @param {number} limit - Số lượng tối đa
     */
    async getPendingModerationReports(limit = 50) {
        const query = `
            SELECT 
                id,
                reporter_name,
                reporter_id,
                flood_level,
                reliability_score,
                validation_status,
                verified_by_sensor,
                photo_url,
                ST_X(location::geometry) as lng, 
                ST_Y(location::geometry) as lat, 
                created_at 
            FROM crowd_reports 
            WHERE moderation_status = 'pending'
            ORDER BY created_at DESC
            LIMIT $1
        `;
        return await this.queryAll(query, [limit]);
    }

    /**
     * Lấy xếp hạng tin cậy của users
     * @param {number} limit - Số lượng tối đa
     */
    async getReliabilityRanking(limit = 100) {
        const query = `
            SELECT 
                reporter_id,
                reporter_name,
                COUNT(*) as total_reports,
                AVG(reliability_score) as avg_reliability,
                SUM(CASE WHEN validation_status = 'cross_verified' THEN 1 ELSE 0 END) as verified_count,
                SUM(CASE WHEN moderation_status = 'approved' THEN 1 ELSE 0 END) as approved_count
            FROM crowd_reports
            WHERE reporter_id IS NOT NULL
            GROUP BY reporter_id, reporter_name
            ORDER BY avg_reliability DESC, verified_count DESC
            LIMIT $1
        `;
        return await this.queryAll(query, [limit]);
    }

    /**
     * Lấy tất cả báo cáo của một user cụ thể
     * @param {number} userId - User ID
     * @param {number} limit - Số lượng tối đa
     * @param {string} moderationStatus - Trạng thái kiểm duyệt (optional)
     */
    async getUserReports(userId, limit = 1000, moderationStatus = null) {
        // Convert userId sang string để match với VARCHAR trong database
        const reporterIdStr = String(userId);
        
        let query = `
            SELECT 
                id,
                reporter_name,
                reporter_id,
                flood_level,
                reliability_score,
                validation_status,
                verified_by_sensor,
                photo_url,
                moderation_status,
                moderated_by,
                moderated_at,
                rejection_reason,
                ST_X(location::geometry) as lng, 
                ST_Y(location::geometry) as lat, 
                created_at 
            FROM crowd_reports 
            WHERE reporter_id = $1
        `;
        const params = [reporterIdStr];
        let paramIndex = 2;

        if (moderationStatus) {
            query += ` AND moderation_status = $${paramIndex++}`;
            params.push(moderationStatus);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
        params.push(limit);

        return await this.queryAll(query, params);
    }

    /**
     * Tạo báo cáo mới từ người dân với xác minh chéo
     * @param {string} name - Tên người báo cáo
     * @param {number} reporterId - ID người báo cáo (user ID từ token, có thể null)
     * @param {string} level - Mức độ ngập (Nhẹ, Trung bình, Nặng)
     * @param {number} lng - Longitude
     * @param {number} lat - Latitude
     * @param {string} photoUrl - URL của ảnh (optional)
     * @param {string} locationDescription - Mô tả vị trí (optional)
     */
    async createReport(name, reporterId, level, lng, lat, photoUrl = null, locationDescription = null) {
        // 1. Kiểm tra có sensor trong 500m không – không có thì không cho tạo báo cáo (đặc tả)
        const validation = await this.crossValidateWithSensors(lng, lat, level);
        if (validation.noSensor) {
            const err = new Error('NO_SENSOR_IN_RADIUS');
            err.code = 'NO_SENSOR_IN_RADIUS';
            throw err;
        }
        // 2. Lấy điểm tin cậy: user đăng nhập lấy từ users.reporter_reliability (Cách C), khách = 50
        let reliabilityScore = 50;
        if (reporterId) {
            const userId = parseInt(reporterId, 10);
            if (!isNaN(userId)) {
                reliabilityScore = await userRepository.getReporterReliability(userId);
            }
        }
        
        // 3. Tạo báo cáo (đã có sensor trong 500m)
        const query = `
            INSERT INTO crowd_reports (
                reporter_name, 
                reporter_id,
                flood_level, 
                location,
                reliability_score,
                validation_status,
                verified_by_sensor,
                photo_url
            )
            VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8, $9)
            RETURNING id, validation_status, verified_by_sensor
        `;
        
        const result = await this.queryOne(query, [
            name,
            reporterId || null, // Đảm bảo không bao giờ là undefined, luôn là number hoặc null
            level,
            lng,
            lat,
            reliabilityScore,
            validation.validation_status || 'pending',
            validation.verified || false,
            photoUrl
        ]);
        
        // 4. Cập nhật điểm tin cậy nếu được xác minh
        if (validation.verified && reporterId) {
            await this.updateReliabilityScore(reporterId, true);
        }
        
        return result;
    }

    /**
     * Xác minh chéo với dữ liệu sensor
     * @param {number} lng - Longitude
     * @param {number} lat - Latitude
     * @param {string} floodLevel - Mức độ ngập
     */
    async crossValidateWithSensors(lng, lat, floodLevel) {
        try {
            // Tìm các sensor trong bán kính 500m
            const sensors = await sensorRepository.findSensorsInRadius(lng, lat, 500);
            // Đặc tả: Nếu không có sensor trong 500m → không cho phép gửi báo cáo
            if (sensors.length === 0) {
                return { noSensor: true, verified: false, validation_status: 'pending' };
            }
            if (sensors.length > 0) {
                const sensor = sensors[0];
                const sensorWaterLevel = sensor.water_level || 0;
                
                // Chuyển đổi flood_level sang cm để so sánh
                const levelMap = {
                    'Nhẹ': 10,      // Đến mắt cá (~10cm)
                    'Trung bình': 30, // Đến đầu gối (~30cm)
                    'Nặng': 50       // Ngập nửa xe (~50cm)
                };
                const reportLevel = levelMap[floodLevel] || 0;
                
                // Xác minh: Nếu sensor báo ngập VÀ người dân báo ngập -> Xác thực 100%
                if (sensor.status === 'danger' || sensor.status === 'warning') {
                    if (sensorWaterLevel >= reportLevel * 0.7) { // Cho phép sai số 30%
                        return {
                            verified: true,
                            sensor_id: sensor.sensor_id,
                            sensor_water_level: sensorWaterLevel,
                            validation_status: 'cross_verified'
                        };
                    }
                }
                
                // Nếu chỉ có người dân báo mà sensor báo bình thường -> Chờ kiểm tra
                if (sensor.status === 'normal' && sensorWaterLevel < 10) {
                    return {
                        verified: false,
                        sensor_id: sensor.sensor_id,
                        sensor_water_level: sensorWaterLevel,
                        validation_status: 'pending'
                    };
                }
            }
            
            return {
                verified: false,
                validation_status: 'pending'
            };
        } catch (err) {
            console.error('❌ [Validation] Error cross-validating:', err.message);
            return {
                verified: false,
                validation_status: 'pending'
            };
        }
    }

    /**
     * Cập nhật điểm tin cậy khi báo cáo được xác minh chéo sensor (Cách B).
     * Cập nhật users.reporter_reliability và đồng bộ sang reliability_score của tất cả báo cáo của reporter.
     * @param {string} reporterId - ID người báo cáo (string như trong DB)
     * @param {boolean} isAccurate - true = cross_verified (+10), false = sai (-10)
     */
    async updateReliabilityScore(reporterId, isAccurate) {
        try {
            if (!reporterId) return null;
            const userId = parseInt(reporterId, 10);
            if (isNaN(userId)) return null;
            const delta = isAccurate ? 10 : -10;
            const newScore = await userRepository.updateReporterReliabilityByDelta(userId, delta);
            await this.query(`
                UPDATE crowd_reports SET reliability_score = $1 WHERE reporter_id = $2
            `, [newScore, reporterId]);
            return newScore;
        } catch (err) {
            console.error('❌ [Reliability] Error updating score:', err.message);
            return null;
        }
    }
}

module.exports = new CrowdReportRepository();

