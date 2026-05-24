const BaseRepository = require('./baseRepository');

const AUTO_APPROVE_THRESHOLD = 5;

/**
 * Repository bổ sung cho auto-approve (không sửa crowdReportRepository).
 */
class CrowdReportAutoApproveRepository extends BaseRepository {
    async getReportForAutoApprove(reportId) {
        const query = `
            SELECT
                id,
                flood_level,
                moderation_status,
                auto_approved,
                sensor_verified,
                nearby_report_count,
                ST_X(location::geometry) AS lng,
                ST_Y(location::geometry) AS lat
            FROM crowd_reports
            WHERE id = $1
        `;
        return await this.queryOne(query, [reportId]);
    }

    async countNearbyReports(lat, lng, floodLevel, radiusMeters = 100) {
        const query = `
            SELECT COUNT(*)::int AS count
            FROM crowd_reports
            WHERE flood_level = $1
              AND ST_DWithin(
                    location,
                    ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                    $4
                  )
        `;
        const row = await this.queryOne(query, [floodLevel, lng, lat, radiusMeters]);
        return row ? row.count : 0;
    }

    async updateNearbyReportCount(reportId, count) {
        await this.query(
            `UPDATE crowd_reports SET nearby_report_count = $1 WHERE id = $2`,
            [count, reportId]
        );
    }

    /** Cập nhật cache count cho mọi báo cáo cùng cụm (cùng flood_level, trong bán kính). */
    async updateNearbyCountsInCluster(lat, lng, floodLevel, count, radiusMeters = 100) {
        await this.query(
            `
            UPDATE crowd_reports
            SET nearby_report_count = $1
            WHERE flood_level = $2
              AND ST_DWithin(
                    location,
                    ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
                    $5
                  )
            `,
            [count, floodLevel, lng, lat, radiusMeters]
        );
    }

    async updateSensorVerified(reportId, verified) {
        await this.query(
            `UPDATE crowd_reports SET sensor_verified = $1 WHERE id = $2`,
            [verified, reportId]
        );
    }

    /** Gán sensor_verified cho cả cụm cùng flood_level trong bán kính. */
    async updateSensorVerifiedInCluster(lat, lng, floodLevel, verified, radiusMeters = 100) {
        await this.query(
            `
            UPDATE crowd_reports
            SET sensor_verified = $1
            WHERE flood_level = $2
              AND ST_DWithin(
                    location,
                    ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
                    $5
                  )
            `,
            [verified, floodLevel, lng, lat, radiusMeters]
        );
    }

    async applyAutoApprove(reportId) {
        await this.query(
            `
            UPDATE crowd_reports
            SET moderation_status = 'approved',
                auto_approved = TRUE,
                moderated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND moderation_status = 'pending'
            `,
            [reportId]
        );
    }

    /**
     * Tự động duyệt mọi báo cáo pending trong cụm (cùng flood_level, bán kính).
     * @returns {Promise<Array<{id: number}>>} Danh sách id đã duyệt
     */
    async applyAutoApproveCluster(lat, lng, floodLevel, radiusMeters = 100) {
        return await this.queryAll(
            `
            UPDATE crowd_reports
            SET moderation_status = 'approved',
                auto_approved = TRUE,
                moderated_at = CURRENT_TIMESTAMP
            WHERE flood_level = $1
              AND moderation_status = 'pending'
              AND COALESCE(auto_approved, FALSE) = FALSE
              AND ST_DWithin(
                    location,
                    ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                    $4
                  )
            RETURNING id
            `,
            [floodLevel, lng, lat, radiusMeters]
        );
    }

    async getSummaryStats() {
        const query = `
            SELECT
                COUNT(*) FILTER (
                    WHERE moderation_status IN ('pending', 'approved')
                )::int AS total_active,
                COUNT(*) FILTER (WHERE auto_approved = TRUE)::int AS auto_approved,
                COUNT(*) FILTER (
                    WHERE moderation_status = 'pending'
                      AND COALESCE(auto_approved, FALSE) = FALSE
                )::int AS pending_manual_review,
                COUNT(*) FILTER (WHERE sensor_verified = TRUE)::int AS sensor_verified,
                COUNT(*) FILTER (
                    WHERE moderation_status = 'pending'
                      AND COALESCE(auto_approved, FALSE) = FALSE
                      AND nearby_report_count > 0
                      AND nearby_report_count < $1
                )::int AS pending_auto_approve
            FROM crowd_reports
        `;
        return await this.queryOne(query, [AUTO_APPROVE_THRESHOLD]);
    }
}

module.exports = new CrowdReportAutoApproveRepository();
