/**
 * Đổi sensor_id S02 → NODE_007 (MQTT: {"sensor_id":"NODE_007","value":...})
 * Chạy: npm run migrate:s02-node-007
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
        const sqlPath = path.join(__dirname, '..', 'database', 'migrate_sensor_s02_to_node_007.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);

        const { rows } = await client.query(
            `SELECT sensor_id, location_name, hardware_type, installation_height, is_active
             FROM sensors WHERE sensor_id = 'NODE_007'`
        );
        if (!rows.length) {
            console.warn(
                '⚠️ Không có NODE_007 sau migration. Kiểm tra DB có S02 hoặc chạy seed trước.'
            );
            process.exitCode = 1;
            return;
        }

        const s02 = await client.query(`SELECT 1 FROM sensors WHERE sensor_id = 'S02'`);
        if (s02.rows.length) {
            console.warn('⚠️ Vẫn còn S02 trong sensors — kiểm tra lại migration.');
            process.exitCode = 1;
            return;
        }

        const logs = await client.query(
            `SELECT COUNT(*)::int AS n FROM flood_logs WHERE sensor_id = 'NODE_007'`
        );
        console.log('✅ S02 → NODE_007 hoàn tất.');
        console.log('   ', rows[0]);
        console.log(`   flood_logs (NODE_007): ${logs.rows[0].n} bản ghi`);
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
