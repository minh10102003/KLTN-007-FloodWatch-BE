const pool = require('../config/db');

// Hàm xác minh chéo với dữ liệu sensor
const crossValidateWithSensors = async (lng, lat, floodLevel) => {
    try {
        // Tìm các sensor trong bán kính 500m
        const result = await pool.query(`
            SELECT 
                s.sensor_id,
                s.location_name,
                l.water_level,
                l.status,
                ST_Distance(s.coords, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance
            FROM sensors s
            LEFT JOIN LATERAL (
                SELECT water_level, status
                FROM flood_logs
                WHERE sensor_id = s.sensor_id
                ORDER BY created_at DESC
                LIMIT 1
            ) l ON true
            WHERE s.is_active = TRUE
            AND ST_Distance(s.coords, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) < 500
            ORDER BY distance
            LIMIT 1
        `, [lng, lat]);

        if (result.rows.length > 0) {
            const sensor = result.rows[0];
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
};

// Hàm cập nhật điểm tin cậy cho người báo cáo
const updateReliabilityScore = async (reporterId, isAccurate) => {
    try {
        if (!reporterId) return;
        
        // Lấy điểm hiện tại
        const currentResult = await pool.query(`
            SELECT AVG(reliability_score) as avg_score
            FROM crowd_reports
            WHERE reporter_id = $1
        `, [reporterId]);
        
        let currentScore = 50; // Mặc định
        if (currentResult.rows[0] && currentResult.rows[0].avg_score) {
            currentScore = parseFloat(currentResult.rows[0].avg_score);
        }
        
        // Cập nhật điểm: +5 nếu chính xác, -10 nếu sai
        const newScore = Math.max(0, Math.min(100, currentScore + (isAccurate ? 5 : -10)));
        
        // Cập nhật điểm cho tất cả báo cáo của người này
        await pool.query(`
            UPDATE crowd_reports
            SET reliability_score = $1
            WHERE reporter_id = $2
        `, [newScore, reporterId]);
        
        return newScore;
    } catch (err) {
        console.error('❌ [Reliability] Error updating score:', err.message);
    }
};

const crowdReportModel = {
    // Lấy các báo cáo từ người dân trong vòng 24 giờ qua
    getRecentReports: async () => {
        const result = await pool.query(`
            SELECT 
                id,
                reporter_name,
                reporter_id,
                flood_level,
                reliability_score,
                validation_status,
                verified_by_sensor,
                ST_X(location::geometry) as lng, 
                ST_Y(location::geometry) as lat, 
                created_at 
            FROM crowd_reports 
            WHERE created_at > NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
        `);
        return result.rows;
    },

    // Tạo báo cáo mới từ người dân với xác minh chéo
    createReport: async (name, reporterId, level, lng, lat) => {
        // 1. Xác minh chéo với sensor
        const validation = await crossValidateWithSensors(lng, lat, level);
        
        // 2. Lấy điểm tin cậy hiện tại
        let reliabilityScore = 50; // Mặc định
        if (reporterId) {
            const scoreResult = await pool.query(`
                SELECT AVG(reliability_score) as avg_score
                FROM crowd_reports
                WHERE reporter_id = $1
            `, [reporterId]);
            
            if (scoreResult.rows[0] && scoreResult.rows[0].avg_score) {
                reliabilityScore = parseFloat(scoreResult.rows[0].avg_score);
            }
        }
        
        // 3. Tạo báo cáo
        const query = `
            INSERT INTO crowd_reports (
                reporter_name, 
                reporter_id,
                flood_level, 
                location,
                reliability_score,
                validation_status,
                verified_by_sensor
            )
            VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8)
            RETURNING id, validation_status, verified_by_sensor
        `;
        
        const result = await pool.query(query, [
            name,
            reporterId || null,
            level,
            lng,
            lat,
            reliabilityScore,
            validation.validation_status || 'pending',
            validation.verified || false
        ]);
        
        // 4. Cập nhật điểm tin cậy nếu được xác minh
        if (validation.verified && reporterId) {
            await updateReliabilityScore(reporterId, true);
        }
        
        return result.rows[0];
    },

    // Lấy tất cả báo cáo (không giới hạn thời gian)
    getAllReports: async (limit = 100) => {
        const result = await pool.query(`
            SELECT 
                id,
                reporter_name,
                reporter_id,
                flood_level,
                reliability_score,
                validation_status,
                verified_by_sensor,
                ST_X(location::geometry) as lng, 
                ST_Y(location::geometry) as lat, 
                created_at 
            FROM crowd_reports 
            ORDER BY created_at DESC
            LIMIT $1
        `, [limit]);
        return result.rows;
    }
};

module.exports = crowdReportModel;

