'use strict';

const { buildPool } = require('./dbPoolFromEnv');

async function main() {
    const pool = buildPool();
    const { rows } = await pool.query(`
        SELECT 'users' AS t, COUNT(*)::int AS c FROM users
        UNION ALL SELECT 'sensors', COUNT(*)::int FROM sensors
        UNION ALL SELECT 'crowd_reports', COUNT(*)::int FROM crowd_reports
        UNION ALL SELECT 'flood_logs', COUNT(*)::int FROM flood_logs
        UNION ALL SELECT 'access_logs', COUNT(*)::int FROM access_logs
        UNION ALL SELECT 'alerts', COUNT(*)::int FROM alerts
        UNION ALL SELECT 'road_nodes', COUNT(*)::int FROM road_nodes
        UNION ALL SELECT 'road_edges', COUNT(*)::int FROM road_edges
    `);
    console.log('Neon row counts:');
    for (const r of rows) console.log(`  ${r.t}: ${r.c}`);
    await pool.end();
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
