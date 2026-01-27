const pool = require('../config/db');

const crowdReportModel = {
    // Lấy các báo cáo từ người dân trong vòng 24 giờ qua
    getRecentReports: async () => {
        const result = await pool.query(`
            SELECT reporter_name, flood_level, 
            ST_X(location::geometry) as lng, 
            ST_Y(location::geometry) as lat, 
            created_at 
            FROM crowd_reports 
            WHERE created_at > NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
        `);
        return result.rows;
    },

    // Tạo báo cáo mới từ người dân
    createReport: async (name, level, lng, lat) => {
        const query = `
            INSERT INTO crowd_reports (reporter_name, flood_level, location)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)
        `;
        await pool.query(query, [name, level, lng, lat]);
    }
};

module.exports = crowdReportModel;

