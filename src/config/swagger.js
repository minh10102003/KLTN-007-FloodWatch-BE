const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

/** Danh sách server cho Try it out — không thêm domain giả (sẽ Failed to fetch nếu DNS chưa trỏ). */
const swaggerServers = [
    {
        url: '/',
        description:
            'Cùng host (Railway): mở Swagger trên chính URL backend → Execute gọi đúng server (nên chọn mục này)'
    },
    {
        url: 'http://localhost:3000',
        description: 'Chỉ khi chạy `npm start` trên máy và vào http://localhost:3000/api-docs'
    }
];
const swaggerPublic = process.env.SWAGGER_PUBLIC_SERVER_URL;
if (swaggerPublic && String(swaggerPublic).trim()) {
    swaggerServers.push({
        url: String(swaggerPublic).replace(/\/$/, ''),
        description: 'Domain công khai của bạn (đặt SWAGGER_PUBLIC_SERVER_URL trên Railway, vd. https://xxx.up.railway.app)'
    });
}

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'HCM Flood Warning System API',
            version: '1.0.0',
            description:
                'API Documentation cho Hệ Thống Giám Sát Ngập Lụt TP.HCM. Trên Swagger, mục Servers phải chọn URL đúng backend (thường là / khi xem /api-docs trên Railway).',
            contact: {
                name: 'API Support',
                email: 'support@hcm-flood.gov.vn'
            },
            license: {
                name: 'ISC',
                url: 'https://opensource.org/licenses/ISC'
            }
        },
        servers: swaggerServers,
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description:
                        'JWT access từ login/register (hoặc /api/auth/refresh). Khi hết hạn, gọi POST /api/auth/refresh với refresh_token + session_token.'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        error: {
                            type: 'string',
                            example: 'Error message'
                        }
                    }
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true
                        },
                        message: {
                            type: 'string',
                            example: 'Operation successful'
                        },
                        data: {
                            type: 'object'
                        }
                    }
                },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        username: { type: 'string', example: 'user123' },
                        email: { type: 'string', example: 'user@example.com' },
                        full_name: { type: 'string', example: 'Nguyễn Văn A' },
                        phone: { type: 'string', example: '0123456789' },
                        role: { type: 'string', enum: ['user', 'admin', 'moderator'], example: 'user' },
                        is_active: { type: 'boolean', example: true },
                        last_login: { type: 'string', format: 'date-time' },
                        email_verified_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            description: 'Đã xác minh email (OTP). null = chưa xác minh, không đăng nhập được.'
                        },
                        last_known_lat: {
                            type: 'number',
                            nullable: true,
                            description: 'Vĩ độ GPS gần nhất (WGS84), từ POST /api/auth/location'
                        },
                        last_known_lng: { type: 'number', nullable: true },
                        last_location_accuracy_m: {
                            type: 'number',
                            nullable: true,
                            description: 'Độ chính xác (m) từ thiết bị'
                        },
                        last_location_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            description: 'Lần cập nhật vị trí gần nhất'
                        },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                Sensor: {
                    type: 'object',
                    properties: {
                        sensor_id: { type: 'string', example: 'S01' },
                        location_name: { type: 'string', example: 'Cầu Sài Gòn - Bình Thạnh' },
                        model: { type: 'string', example: 'HC-SR04' },
                        hardware_type: { type: 'string', example: 'ESP32' },
                        installation_date: { type: 'string', format: 'date' },
                        installation_height: { type: 'number', example: 150 },
                        is_active: { type: 'boolean', example: true },
                        status: { type: 'string', enum: ['normal', 'warning', 'danger', 'offline'], example: 'normal' },
                        lng: { type: 'number', example: 106.721 },
                        lat: { type: 'number', example: 10.798 },
                        warning_threshold: { type: 'number', example: 10 },
                        danger_threshold: { type: 'number', example: 30 }
                    }
                },
                FloodData: {
                    type: 'object',
                    properties: {
                        sensor_id: { type: 'string', example: 'S01' },
                        location_name: { type: 'string', example: 'Cầu Sài Gòn - Bình Thạnh' },
                        water_level: { type: 'number', example: 5.5 },
                        velocity: { type: 'number', example: 0.2 },
                        status: { type: 'string', enum: ['normal', 'warning', 'danger', 'offline'] },
                        lng: { type: 'number', example: 106.721 },
                        lat: { type: 'number', example: 10.798 },
                        warning_threshold: { type: 'number', example: 10 },
                        danger_threshold: { type: 'number', example: 30 },
                        temperature: { type: 'number', nullable: true, description: 'Nhiệt độ °C (DHT22)', example: 28.5 },
                        humidity: { type: 'number', nullable: true, description: 'Độ ẩm % (DHT22)', example: 65 }
                    }
                },
                Alert: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        sensor_id: { type: 'string', example: 'S01' },
                        alert_type: { type: 'string', enum: ['warning', 'danger', 'offline', 'velocity_spike'] },
                        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                        message: { type: 'string', example: 'Cảnh báo ngập lụt...' },
                        water_level: { type: 'number', example: 35.5 },
                        velocity: { type: 'number', example: 2.5 },
                        status: { type: 'string', enum: ['active', 'acknowledged', 'resolved'] },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                CrowdReport: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        reporter_name: { type: 'string', example: 'Nguyễn Văn A' },
                        reporter_id: { type: 'string', example: 'user123' },
                        flood_level: { type: 'string', enum: ['Nhẹ', 'Trung bình', 'Nặng'] },
                        reliability_score: { type: 'number', example: 75 },
                        validation_status: { type: 'string', enum: ['pending', 'verified', 'rejected', 'cross_verified'] },
                        verified_by_sensor: { type: 'boolean', example: true },
                        photo_url: { type: 'string', example: 'https://example.com/photo.jpg' },
                        content: { type: 'string', maxLength: 500, description: 'Nội dung mô tả mức độ ngập (tùy chọn)' },
                        photo_urls: { type: 'array', items: { type: 'string' }, description: 'Mảng URL ảnh (tối đa 5)' },
                        moderation_status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
                        lng: { type: 'number', example: 106.721 },
                        lat: { type: 'number', example: 10.798 },
                        created_at: { type: 'string', format: 'date-time' },
                        confidence: {
                            type: 'integer',
                            minimum: 0,
                            maximum: 100,
                            description:
                                'Độ tin cậy tổng hợp (A2): từ reliability_score, kiểm duyệt, validation, cảm biến, ảnh'
                        },
                        confidence_breakdown: {
                            type: 'object',
                            additionalProperties: { type: 'number' },
                            description: 'Các thành phần cộng/trừ điểm (debug/demo)'
                        }
                    }
                },
                ShortForecast: {
                    type: 'object',
                    properties: {
                        sensor_id: { type: 'string', example: 'S01' },
                        location_name: { type: 'string', nullable: true },
                        horizon_minutes: { type: 'integer', example: 60 },
                        current_water_level_cm: { type: 'number', nullable: true },
                        velocity_cm_per_hour: { type: 'number', nullable: true },
                        predicted_water_level_cm: { type: 'number', nullable: true },
                        warning_threshold_cm: { type: 'number' },
                        danger_threshold_cm: { type: 'number' },
                        may_exceed_warning_within_horizon: { type: 'boolean' },
                        may_exceed_danger_within_horizon: { type: 'boolean' },
                        estimated_minutes_to_warning: { type: 'integer', nullable: true },
                        estimated_minutes_to_danger: { type: 'integer', nullable: true },
                        confidence: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
                        sample_count: { type: 'integer' },
                        span_minutes: { type: 'number', nullable: true },
                        method: { type: 'string', example: 'linear_trend' }
                    }
                }
            }
        },
        tags: [
            {
                name: 'Authentication',
                description: 'APIs cho đăng ký, đăng nhập, quản lý profile'
            },
            {
                name: 'Sensors',
                description: 'APIs quản lý sensors và ngưỡng báo động'
            },
            {
                name: 'Flood Data',
                description: 'APIs lấy dữ liệu ngập lụt real-time và lịch sử'
            },
            {
                name: 'Crowd Reports',
                description: 'APIs cho báo cáo từ người dân'
            },
            {
                name: 'Alerts',
                description: 'APIs quản lý cảnh báo ngập lụt'
            },
            {
                name: 'Report Moderation',
                description: 'APIs kiểm duyệt báo cáo (cần quyền moderator/admin)'
            },
            {
                name: 'Report Evaluation',
                description: 'APIs đánh giá báo cáo'
            },
            {
                name: 'Emergency Subscription',
                description: 'APIs đăng ký nhận cảnh báo khẩn'
            },
            {
                name: 'Heatmap',
                description: 'APIs lấy dữ liệu heatmap'
            },
            {
                name: 'Sensor–Crowd Fusion',
                description:
                    'Hợp nhất mực nước cảm biến và báo cáo đám đông (trọng số động theo khoảng cách và độ lệch)'
            },
            {
                name: 'Forecast',
                description: 'Dự báo mực nước ngắn hạn theo sensor (xu hướng tuyến tính từ flood_logs)'
            },
            {
                name: 'Weather',
                description:
                    'Thời tiết TP.HCM qua Open-Meteo (https://open-meteo.com/) — không cần API key'
            },
            {
                name: 'Device Health',
                description: 'Theo dõi sức khỏe trạm cảm biến (admin): online / degraded / offline'
            },
            {
                name: 'OTA Updates',
                description: 'APIs quản lý cập nhật firmware OTA'
            },
            {
                name: 'Energy Monitoring',
                description: 'APIs theo dõi năng lượng sensors'
            }
        ]
    },
    apis: [
        './src/routes/*.js',
        './src/controllers/*.js'
    ]
};

const swaggerSpec = swaggerJsdoc(options);

const swaggerSetup = (app) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'HCM Flood Warning System API',
        customfavIcon: '/favicon.ico'
    }));
    
    // JSON endpoint
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
};

module.exports = swaggerSetup;

