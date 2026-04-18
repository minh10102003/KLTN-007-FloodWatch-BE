const { Pool } = require('pg');
require('dotenv').config();

const isLocal = !process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT === 'local';
const internalHost = process.env.DB_HOST && process.env.DB_HOST.includes('.railway.internal');

if (isLocal && internalHost && !process.env.DATABASE_URL) {
    console.error('\n❌ LỖI KẾT NỐI: Bạn đang chạy ở máy local nhưng lại dùng host nội bộ của Railway (postgis.railway.internal).');
    console.error('👉 Vui lòng sử dụng "Public Connection String" từ tab Connect của Railway và gán vào biến DATABASE_URL.\n');
    process.exit(1);
}

const pool = new Pool(
    process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL } 
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASS,
        port: process.env.DB_PORT,
    }
);

async function reverseGeocode(lat, lng) {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Xây dựng địa chỉ từ các trường của BigDataCloud
    const parts = [];
    if (data.locality) parts.push(data.locality);
    if (data.city) parts.push(data.city);
    if (data.principalSubdivision) parts.push(data.principalSubdivision);
    
    return parts.join(', ') || 'Không xác định được địa chỉ';
}

async function run() {
    const client = await pool.connect();
    try {
        console.log('Bắt đầu geocode cho các sensors...');
        const { rows } = await client.query('SELECT sensor_id, ST_X(coords::geometry) as lng, ST_Y(coords::geometry) as lat FROM sensors WHERE coords IS NOT NULL');
        
        for (const row of rows) {
            console.log(`Đang xử lý sensor ${row.sensor_id} tại (${row.lat}, ${row.lng})...`);
            try {
                let address = await reverseGeocode(row.lat, row.lng);
                
                // Cắt bớt phần mã bưu điện hoặc quốc gia nếu quá dài (tùy chọn)
                address = address.replace(/, \d{5,}, Việt Nam$/, '');
                address = address.replace(/, Việt Nam$/, '');
                
                console.log(` -> Địa chỉ: ${address}`);
                await client.query('UPDATE sensors SET location_name = $1 WHERE sensor_id = $2', [address, row.sensor_id]);
                
                // Sleep 1.5s để tránh spam API
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (error) {
                console.error(` -> Lỗi geocode sensor ${row.sensor_id}:`, error.message);
            }
        }
        console.log('Cập nhật hoàn tất!');
    } catch (err) {
        console.error('Lỗi kết nối DB:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
