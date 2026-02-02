const BaseRepository = require('./baseRepository');

/**
 * Emergency Subscription Repository
 * Chứa tất cả các query liên quan đến đăng ký khẩn
 */
class EmergencySubscriptionRepository extends BaseRepository {
    /**
     * Tạo subscription mới
     * @param {Object} subscriptionData - Dữ liệu subscription
     */
    async createSubscription(subscriptionData) {
        const {
            user_id,
            lng,
            lat,
            radius = 1000,
            notification_methods = ['email', 'sms']
        } = subscriptionData;

        const query = `
            INSERT INTO emergency_subscriptions (user_id, location, radius, notification_methods)
            VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5)
            RETURNING *
        `;
        return await this.queryOne(query, [user_id, lng, lat, radius, notification_methods]);
    }

    /**
     * Lấy subscriptions của user
     * @param {number} userId - User ID
     */
    async getSubscriptionsByUser(userId) {
        const query = `
            SELECT 
                id,
                user_id,
                ST_X(location::geometry) as lng,
                ST_Y(location::geometry) as lat,
                radius,
                notification_methods,
                is_active,
                created_at,
                updated_at
            FROM emergency_subscriptions
            WHERE user_id = $1
            ORDER BY created_at DESC
        `;
        return await this.queryAll(query, [userId]);
    }

    /**
     * Cập nhật subscription
     * @param {number} subscriptionId - Subscription ID
     * @param {Object} subscriptionData - Dữ liệu cần cập nhật
     */
    async updateSubscription(subscriptionId, subscriptionData) {
        const {
            lng,
            lat,
            radius,
            notification_methods,
            is_active
        } = subscriptionData;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (lng !== undefined && lat !== undefined) {
            updates.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography`);
            values.push(lng, lat);
            paramIndex += 2;
        }
        if (radius !== undefined) {
            updates.push(`radius = $${paramIndex++}`);
            values.push(radius);
        }
        if (notification_methods !== undefined) {
            updates.push(`notification_methods = $${paramIndex++}`);
            values.push(notification_methods);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return await this.getSubscriptionById(subscriptionId);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(subscriptionId);

        await this.query(`
            UPDATE emergency_subscriptions 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
        `, values);

        return await this.getSubscriptionById(subscriptionId);
    }

    /**
     * Lấy subscription theo ID
     * @param {number} subscriptionId - Subscription ID
     */
    async getSubscriptionById(subscriptionId) {
        const query = `
            SELECT 
                id,
                user_id,
                ST_X(location::geometry) as lng,
                ST_Y(location::geometry) as lat,
                radius,
                notification_methods,
                is_active,
                created_at,
                updated_at
            FROM emergency_subscriptions
            WHERE id = $1
        `;
        return await this.queryOne(query, [subscriptionId]);
    }

    /**
     * Xóa subscription
     * @param {number} subscriptionId - Subscription ID
     */
    async deleteSubscription(subscriptionId) {
        const query = `
            DELETE FROM emergency_subscriptions
            WHERE id = $1
            RETURNING *
        `;
        return await this.queryOne(query, [subscriptionId]);
    }

    /**
     * Tìm users cần nhận cảnh báo trong bán kính
     * @param {number} lng - Longitude
     * @param {number} lat - Latitude
     * @param {number} alertRadius - Bán kính cảnh báo (mét)
     */
    async findUsersInAlertRadius(lng, lat, alertRadius) {
        const query = `
            SELECT DISTINCT
                es.user_id,
                u.email,
                u.phone,
                u.full_name,
                es.notification_methods,
                ST_Distance(es.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance
            FROM emergency_subscriptions es
            INNER JOIN users u ON es.user_id = u.id
            WHERE es.is_active = TRUE
            AND u.is_active = TRUE
            AND ST_Distance(es.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) <= GREATEST(es.radius, $3)
            ORDER BY distance
        `;
        return await this.queryAll(query, [lng, lat, alertRadius]);
    }
}

module.exports = new EmergencySubscriptionRepository();

