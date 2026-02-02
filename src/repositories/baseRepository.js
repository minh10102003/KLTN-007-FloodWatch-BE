const pool = require('../config/db');

/**
 * Base Repository Class
 * Cung cấp các phương thức chung cho tất cả repositories
 */
class BaseRepository {
    constructor() {
        this.pool = pool;
    }

    /**
     * Thực thi query SQL
     * @param {string} query - SQL query string
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>} Query results
     */
    async query(query, params = []) {
        try {
            const result = await this.pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('❌ [Repository] Query Error:', error.message);
            throw error;
        }
    }

    /**
     * Thực thi query và trả về một row duy nhất
     * @param {string} query - SQL query string
     * @param {Array} params - Query parameters
     * @returns {Promise<Object|null>} Single row or null
     */
    async queryOne(query, params = []) {
        const rows = await this.query(query, params);
        return rows[0] || null;
    }

    /**
     * Thực thi query và trả về tất cả rows
     * @param {string} query - SQL query string
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>} All rows
     */
    async queryAll(query, params = []) {
        return await this.query(query, params);
    }
}

module.exports = BaseRepository;

