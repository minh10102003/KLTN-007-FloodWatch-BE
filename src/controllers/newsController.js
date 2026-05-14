const newsFeedService = require('../services/newsFeedService');

const CACHE_MAX_AGE = Math.min(3600, Math.max(60, parseInt(process.env.NEWS_HTTP_CACHE_SECONDS || '900', 10) || 900));

const newsController = {
    async getNews(req, res) {
        try {
            const articles = await newsFeedService.getFloodRelatedNews();
            res.setHeader('Cache-Control', `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}`);
            res.json({ success: true, data: articles });
        } catch (err) {
            console.error('[news]', err.message);
            res.status(500).json({ success: false, error: 'Không thể tải tin tức.', data: [] });
        }
    },
};

module.exports = newsController;
