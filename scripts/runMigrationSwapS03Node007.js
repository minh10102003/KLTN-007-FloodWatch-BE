/**
 * Hoán đổi S03 ↔ NODE_007: Bình Quới = S03 (khớp MQTT), Vườn Lài = NODE_007.
 * Chạy: npm run migrate:swap-s03-node007
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL
    ? new Pool({
          connectionString: process.env.DATABASE_URL,
          ...(process.env.DB_SSL === 'false' ? {} : { ssl: { rejectUnauthorized: false } })
      })
    : new Pool({
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          password: process.env.DB_PASS,
          port: process.env.DB_PORT
      });

async function run() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(
            __dirname,
            '..',
            'database',
            'migrate_swap_s03_binh_quoi_node007_vuon_lai.sql'
        );
        await client.query(fs.readFileSync(sqlPath, 'utf8'));

        const { rows } = await client.query(
            `SELECT sensor_id, location_name,
                    ROUND(ST_Y(coords::geometry)::numeric, 6) AS lat,
                    ROUND(ST_X(coords::geometry)::numeric, 6) AS lng,
                    installation_height
             FROM sensors
             WHERE sensor_id IN ('S01', 'S03', 'NODE_007')
             ORDER BY sensor_id`
        );
        console.log('✅ Hoán đổi xong — trạm hiện tại:');
        for (const r of rows) {
            console.log(
                `   ${r.sensor_id}: ${r.location_name} (${r.lat}, ${r.lng}) H=${r.installation_height}cm`
            );
        }
        const temp = await client.query(`SELECT 1 FROM sensors WHERE sensor_id = 'TEMP_BQ'`);
        if (temp.rows.length) {
            console.warn('⚠️ Còn TEMP_BQ — migration chưa hoàn tất.');
            process.exitCode = 1;
        }
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
