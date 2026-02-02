const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'HCM Flood Warning System API',
            version: '1.0.0',
            description: 'API Documentation cho Hệ Thống Giám Sát Ngập Lụt TP.HCM',
            contact: {
                name: 'API Support',
                email: 'support@hcm-flood.gov.vn'
            },
            license: {
                name: 'ISC',
                url: 'https://opensource.org/licenses/ISC'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server'
            },
            {
                url: 'https://api.hcm-flood.gov.vn',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Nhập JWT token từ đăng nhập'
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
                        danger_threshold: { type: 'number', example: 30 }
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
                        moderation_status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
                        lng: { type: 'number', example: 106.721 },
                        lat: { type: 'number', example: 10.798 },
                        created_at: { type: 'string', format: 'date-time' }
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

