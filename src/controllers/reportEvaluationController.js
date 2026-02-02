const reportEvaluationRepository = require('../repositories/reportEvaluationRepository');

const reportEvaluationController = {
    // Tạo đánh giá mới
    createEvaluation: async (req, res) => {
        try {
            const { reportId } = req.params;
            const { rating, comment } = req.body;

            if (!rating || rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Rating phải từ 1 đến 5'
                });
            }

            const data = await reportEvaluationRepository.createEvaluation({
                report_id: parseInt(reportId),
                evaluator_id: req.user.id,
                rating: parseInt(rating),
                comment
            });

            res.status(201).json({
                success: true,
                message: 'Đánh giá thành công',
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy đánh giá của một report
    getEvaluationsByReport: async (req, res) => {
        try {
            const { reportId } = req.params;
            const data = await reportEvaluationRepository.getEvaluationsByReport(parseInt(reportId));
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // Lấy điểm trung bình của report
    getAverageRating: async (req, res) => {
        try {
            const { reportId } = req.params;
            const data = await reportEvaluationRepository.getAverageRating(parseInt(reportId));
            res.json({
                success: true,
                data: data
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = reportEvaluationController;

