# 🌊 HCM Flood Backend API

> Backend API system for Ho Chi Minh City Flood Warning and Monitoring System

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-blue.svg)](https://www.postgresql.org/)
[![Express](https://img.shields.io/badge/Express-5.2-black.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

A comprehensive backend system for real-time flood monitoring, sensor data processing, crowdsourcing reports, and emergency alert management in Ho Chi Minh City.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [MQTT Integration](#-mqtt-integration)
- [Database Schema](#-database-schema)
- [Scripts](#-scripts)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

- 🔐 **Authentication & Authorization** - JWT-based auth with role-based access control (admin, moderator, user)
- 📡 **Real-time Sensor Data** - MQTT integration for receiving flood sensor data
- 🗺️ **Geospatial Processing** - PostGIS for location-based queries and heatmap generation
- 📊 **Crowdsourcing Reports** - User-submitted flood reports with moderation system
- 🚨 **Alert Management** - Automated alerts based on water level thresholds
- ⚡ **Energy Monitoring** - Track sensor battery levels and power consumption
- 🔄 **OTA Updates** - Over-the-air firmware updates for sensors
- 📈 **Data Analytics** - Historical data analysis and velocity calculations
- 🎯 **Kalman Filtering** - Noise reduction for sensor data
- 📖 **Swagger Documentation** - Interactive API documentation

## 🛠️ Tech Stack

### Core
- **Runtime:** Node.js 14+
- **Framework:** Express.js 5.2
- **Database:** PostgreSQL 12+ with PostGIS extension
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt

### Integration
- **MQTT:** mqtt.js (HiveMQ Cloud)
- **API Docs:** Swagger UI + Swagger JSDoc
- **CORS:** Enabled for cross-origin requests

### Development
- **Environment:** dotenv
- **Database Client:** pg (node-postgres)

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 14.0.0 ([Download](https://nodejs.org/))
- **PostgreSQL** >= 12.0 ([Download](https://www.postgresql.org/download/))
- **PostGIS Extension** (included with PostgreSQL Stack Builder)
- **Git** (optional, for cloning)

## 🚀 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd hcm-flood-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up PostgreSQL database

```sql
-- Create database
CREATE DATABASE hcm_flood;

-- Connect to database
\c hcm_flood

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 4. Run database schema

Using **pgAdmin 4** (Recommended):
1. Open pgAdmin 4
2. Connect to PostgreSQL server
3. Right-click on `hcm_flood` database → **Query Tool**
4. Open and execute `database/schema.sql`

Or using **psql**:
```bash
psql -U postgres -d hcm_flood -f database/schema.sql
```

### 5. Configure environment variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hcm_flood
DB_USER=postgres
DB_PASS=your_postgres_password

# JWT Secret (change to a random string)
JWT_SECRET=your-secret-key-change-this-to-random-string

# MQTT Configuration (HiveMQ Cloud)
MQTT_HOST=1af3004441454f2aabda930c941a552d.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USER=tram_cam_bien_1
MQTT_PASS=Minh@2003

# Server Port
PORT=3000
```

### 6. Create admin user

```bash
npm run create-admin
```

Default admin credentials:
- **Username:** `admin`
- **Password:** `admin123`
- **Email:** `admin@hcm-flood.gov.vn`

⚠️ **Important:** Change the default password after first login!

### 7. Run migrations (if needed)

```bash
npm run migrate
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `hcm_flood` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASS` | Database password | - |
| `JWT_SECRET` | JWT signing secret | - |
| `MQTT_HOST` | MQTT broker host | - |
| `MQTT_PORT` | MQTT broker port | `8883` |
| `MQTT_USER` | MQTT username | - |
| `MQTT_PASS` | MQTT password | - |
| `PORT` | Server port | `3000` |

## 🎯 Usage

### Start the server

```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### Verify installation

1. **Check server status:**
   ```
   http://localhost:3000
   ```

2. **Access Swagger UI:**
   ```
   http://localhost:3000/api-docs
   ```

3. **Test authentication:**
   - Use Swagger UI or Postman
   - POST `/api/auth/login`
   - Body: `{"username": "admin", "password": "admin123"}`

### Expected output

```
✅ Đã kết nối thành công tới PostgreSQL!
✅ [MQTT] Connected and Subscribed
    ===========================================
    🚀 SERVER IS RUNNING ON PORT: 3000
    📡 MQTT WORKER IS LISTENING...
    ===========================================
```

## 📚 API Documentation

### Interactive Documentation

Access the full API documentation at:
```
http://localhost:3000/api-docs
```

### Base URL

```
Development: http://localhost:3000/api
Production: https://api.hcm-flood.gov.vn/api
```

### Authentication

All protected endpoints require a JWT Bearer token:

```http
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/auth/login` | POST | User login | No |
| `/api/auth/register` | POST | User registration | No |
| `/api/v1/flood-data/realtime` | GET | Get real-time flood data | No |
| `/api/sensors` | GET | List all sensors | No |
| `/api/sensors/:id` | GET | Get sensor details | No |
| `/api/report-flood` | POST | Submit flood report | No |
| `/api/crowd-reports` | GET | Get crowd reports | No |
| `/api/alerts` | GET | Get alerts | Yes |
| `/api/reports/pending` | GET | Get pending reports | Moderator+ |
| `/api/sensors` | POST | Create sensor | Admin |

For complete API documentation, see [COMPLETE_BACKEND_GUIDE.md](./COMPLETE_BACKEND_GUIDE.md)

## 📁 Project Structure

```
hcm-flood-backend/
├── src/
│   ├── app.js                 # Express app configuration
│   ├── config/
│   │   ├── db.js             # Database connection
│   │   └── swagger.js        # Swagger configuration
│   ├── controllers/          # Request handlers
│   ├── middleware/
│   │   └── auth.js           # JWT authentication middleware
│   ├── models/               # Data models
│   ├── repositories/         # Database access layer
│   ├── routes/               # API routes
│   └── services/
│       └── mqttService.js     # MQTT client service
├── database/
│   ├── schema.sql            # Database schema
│   └── add_new_features.sql  # Additional migrations
├── scripts/
│   ├── createAdminUser.js    # Admin user creation script
│   ├── runMigration.js       # Migration runner
│   └── checkModerationStatus.js
├── server.js                 # Server entry point
├── package.json
├── .env                      # Environment variables (not in git)
└── README.md
```

## 📡 MQTT Integration

### MQTT Broker

The system uses **HiveMQ Cloud** as the MQTT broker for receiving sensor data.

- **Host:** `1af3004441454f2aabda930c941a552d.s1.eu.hivemq.cloud`
- **Port:** `8883` (MQTT over TLS)
- **Protocol:** `mqtts://`
- **Topic:** `hcm/flood/data`

### Sensor Simulation

The system integrates with **Wokwi ESP32 Simulator** for testing:

🔗 **Wokwi Project:** [https://wokwi.com/projects/454234830706408449](https://wokwi.com/projects/454234830706408449)

The simulator automatically sends flood sensor data to the MQTT broker every 3 seconds.

### Data Flow

```
Wokwi Simulator → HiveMQ Cloud → Backend MQTT Service → Database
```

### MQTT Message Format

```json
{
  "sensor_id": "S01",
  "value": 150,
  "timestamp": "2024-12-20T10:00:00Z",
  "checksum": "abc123def456"
}
```

## 🗄️ Database Schema

### Main Tables

- **`sensors`** - Sensor station information
- **`sensor_thresholds`** - Alert thresholds per sensor
- **`flood_logs`** - Historical flood data
- **`crowd_reports`** - User-submitted flood reports
- **`users`** - User accounts and authentication
- **`alerts`** - System alerts and notifications
- **`emergency_subscriptions`** - User alert subscriptions
- **`energy_logs`** - Sensor energy/battery monitoring
- **`ota_updates`** - Firmware update management

### Geospatial Features

The database uses **PostGIS** for geospatial operations:
- Location storage (GEOGRAPHY type)
- Distance calculations
- Heatmap generation
- Radius-based queries

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the server |
| `npm run create-admin` | Create admin user |
| `npm run migrate` | Run database migrations |
| `npm run check-moderation` | Check moderation status |

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Error

```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
1. Ensure PostgreSQL service is running
2. Check `.env` database credentials
3. Verify database `hcm_flood` exists

#### MQTT Connection Failed

```bash
MQTT connection error
```

**Solution:**
1. Verify internet connection (HiveMQ Cloud requires internet)
2. Check MQTT credentials in `.env`
3. Test connection with MQTT Explorer

#### Port Already in Use

```bash
Error: Port 3000 is already in use
```

**Solution:**
1. Change `PORT` in `.env`
2. Or kill the process using port 3000:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

For more troubleshooting, see [HUONG_DAN_CAI_DAT_BACKEND.md](./HUONG_DAN_CAI_DAT_BACKEND.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style

- Follow existing code patterns
- Use meaningful variable names
- Add comments for complex logic
- Update documentation for API changes

## 📄 License

This project is licensed under the ISC License.

## 👥 Authors

- **Project Team** - *Initial work*

## 🙏 Acknowledgments

- Wokwi for ESP32 simulation platform
- HiveMQ Cloud for MQTT broker service
- PostGIS community for geospatial extensions

---

<<<<<<< HEAD
**For detailed setup instructions in Vietnamese, see [HUONG_DAN_CAI_DAT_BACKEND.md](./HUONG_DAN_CAI_DAT_BACKEND.md)**

**For complete API documentation, see [COMPLETE_BACKEND_GUIDE.md](./COMPLETE_BACKEND_GUIDE.md)**

=======
>>>>>>> a9b2cfd0526322a48744cdecbbcb8f5dc9220391
