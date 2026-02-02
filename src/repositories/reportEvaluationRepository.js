const BaseRepository = require('./baseRepository');

/**
 * Report Evaluation Repository
 * Chứa tất cả các query liên quan đến đánh giá báo cáo
 */
class ReportEvaluationRepository extends BaseRepository {
    /**
     * Tạo đánh giá mới
     * @param {Object} evaluationData - Dữ liệu đánh giá
     */
    async createEvaluation(evaluationData) {
        const {
            report_id,
            evaluator_id,
            rating,
            comment
        } = evaluationData;

        const query = `
            INSERT INTO report_evaluations (report_id, evaluator_id, rating, comment)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (report_id, evaluator_id) 
            DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
            RETURNING *
        `;
        return await this.queryOne(query, [report_id, evaluator_id, rating, comment]);
    }

    /**
     * Lấy đánh giá theo report_id
     * @param {number} reportId - Report ID
     */
    async getEvaluationsByReport(reportId) {
        const query = `
            SELECT 
                e.*,
                u.username as evaluator_username,
                u.full_name as evaluator_name
            FROM report_evaluations e
            LEFT JOIN users u ON e.evaluator_id = u.id
            WHERE e.report_id = $1
            ORDER BY e.created_at DESC
        `;
        return await this.queryAll(query, [reportId]);
    }

    /**
     * Lấy điểm trung bình của report
     * @param {number} reportId - Report ID
     */
    async getAverageRating(reportId) {
        const query = `
            SELECT 
                AVG(rating) as avg_rating,
                COUNT(*) as total_evaluations
            FROM report_evaluations
            WHERE report_id = $1
        `;
        return await this.queryOne(query, [reportId]);
    }

    /**
     * Xóa đánh giá
     * @param {number} evaluationId - Evaluation ID
     */
    async deleteEvaluation(evaluationId) {
        const query = `
            DELETE FROM report_evaluations
            WHERE id = $1
            RETURNING *
        `;
        return await this.queryOne(query, [evaluationId]);
    }
}

module.exports = new ReportEvaluationRepository();

