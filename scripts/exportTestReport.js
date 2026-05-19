/**
 * Xuất bảng kết quả Jest (Backend Node) ra file .xlsx theo form luận văn:
 *   Mã TC | Test Case | Các bước thực hiện | Dữ liệu đầu vào
 *   | Kết quả mong đợi | Kết quả thực tế | Trạng thái
 *
 * Hỗ trợ nhiều "feature" (kalman / realtime / telegram). Mỗi feature có
 * pattern test riêng và file .xlsx riêng.
 *
 * Cách dùng:
 *   node scripts/exportTestReport.js --feature kalman
 *   node scripts/exportTestReport.js --feature realtime
 *   node scripts/exportTestReport.js --feature telegram
 *   node scripts/exportTestReport.js --all      # chạy tất cả tuần tự
 *
 * Đường dẫn xuất mặc định:
 *   D:\KhoaLuan_2026_Nhom007\test_report_<feature>.xlsx
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');

// ── Khai báo các feature ────────────────────────────────────────────────────

const FEATURES = {
    kalman: {
        title: 'BẢNG KẾT QUẢ KIỂM THỬ — LỌC NHIỄU KALMAN (BACKEND NODE.JS)',
        sheetName: 'Kalman Filter',
        defaultOutput: 'D:\\KhoaLuan_2026_Nhom007\\test_report_kalman_filter.xlsx',
        testPathPattern: 'kalmanFilterService',
        meta: {
            'KalmanFilter — lọc chuỗi mực nước có spike filterWaterLevelSeries: spike 100 không xuất hiện ở đầu ra (gate innovation)':
                {
                    code: 'TC_K01',
                    name: 'Loại spike 100 khỏi chuỗi đầu ra',
                    steps: [
                        '1. Gọi filterWaterLevelSeries([10, 100, 11, 12])',
                        '   với innovationGateCm = 30, processNoise = 0.01,',
                        '   measurementNoise = 0.25.',
                        '2. So sánh mảng đầu ra với giá trị spike 100.',
                    ].join('\n'),
                    inputs:
                        'Mảng đo: [10, 100, 11, 12];\nprocessNoise = 0.01;\nmeasurementNoise = 0.25;\ninnovationGateCm = 30',
                    expected:
                        'Đầu ra dài 4; mọi phần tử hữu hạn;\nphần tử đầu = 10; giá trị 100 KHÔNG có trong đầu ra.',
                    actual:
                        '[10, 10, 10.456990174107913, 10.969258547864818]\n→ 100 đã bị loại bỏ.',
                },
            'KalmanFilter — lọc chuỗi mực nước có spike Kalman không gate: spike vẫn kéo estimate mạnh (không “loại” hẳng 100 trong một bước)':
                {
                    code: 'TC_K02',
                    name: 'Không gate — spike kéo lệch estimate',
                    steps: [
                        '1. Khởi tạo KalmanFilter(0.01, 0.25) (không gate).',
                        '2. Lần lượt filter(10), filter(100).',
                        '3. Kiểm tra estimate sau spike nằm trong (50, 100).',
                    ].join('\n'),
                    inputs:
                        'Đo thô: 10 rồi 100;\nprocessNoise = 0.01;\nmeasurementNoise = 0.25;\ninnovationGateCm = null',
                    expected:
                        'filter(10) = 10;\n50 < filter(100) < 100 (spike vẫn kéo estimate).',
                    actual: 'filter(10) = 10; filter(100) ≈ 82.14',
                },
            'KalmanFilter — lọc chuỗi mực nước có spike filterWaterLevelSeries: không gate — hành vi giống pipeline MQTT trên chuỗi ngắn':
                {
                    code: 'TC_K03',
                    name: 'Tương thích pipeline MQTT (không gate)',
                    steps: [
                        '1. Gọi filterWaterLevelSeries([10, 100, 11, 12])',
                        '   với cấu hình mặc định (không gate).',
                        '2. So sánh phần tử thứ 2 với giá trị tham chiếu ≈ 82.142857.',
                    ].join('\n'),
                    inputs:
                        'Mảng đo: [10, 100, 11, 12];\nKhông truyền innovationGateCm (mặc định = null)',
                    expected: 'filtered[1] ≈ 82.142857 (sai số 1e-3)',
                    actual:
                        '[10, 82.14285714285715, 49.63127047060853, 37.13795422407083]\n→ filtered[1] ≈ 82.142857.',
                },
        },
    },

    realtime: {
        title:
            'BẢNG KẾT QUẢ KIỂM THỬ — GIÁM SÁT MỰC NƯỚC THỜI GIAN THỰC (REAL-TIME MAPPING)',
        sheetName: 'Realtime Mapping',
        defaultOutput: 'D:\\KhoaLuan_2026_Nhom007\\test_report_realtime_mapping.xlsx',
        testPathPattern: 'realtimeMapping',
        meta: {
            'Real-time Mapping — đổi màu marker theo MQTT MQTT báo mực nước thấp → marker GIỮ MÀU XANH (normal)':
                {
                    code: 'TC_M01',
                    name: 'MQTT bình thường → marker xanh',
                    steps: [
                        '1. Giả lập gói MQTT raw_distance = 95cm.',
                        '2. computeMapPointFromRaw({installationHeight: 100,',
                        '   thresholds: {warning:10, danger:30}}).',
                    ].join('\n'),
                    inputs:
                        'rawDistance = 95; installationHeight = 100;\nthresholds = {warning:10, danger:30}',
                    expected:
                        'water_level = 5; status = normal; color = green.',
                    actual:
                        'water_level = 5; status = "normal"; color = "green".',
                },
            'Real-time Mapping — đổi màu marker theo MQTT MQTT báo mực nước vượt ngưỡng warning → marker VÀNG':
                {
                    code: 'TC_M02',
                    name: 'Vượt warning → marker vàng',
                    steps: [
                        '1. Giả lập gói MQTT raw_distance = 85cm.',
                        '2. computeMapPointFromRaw(...).',
                    ].join('\n'),
                    inputs:
                        'rawDistance = 85; installationHeight = 100;\nthresholds = {warning:10, danger:30}',
                    expected:
                        'water_level = 15; status = warning; color = yellow.',
                    actual:
                        'water_level = 15; status = "warning"; color = "yellow".',
                },
            'Real-time Mapping — đổi màu marker theo MQTT MQTT báo ngập nặng → marker ĐỎ (đổi từ Xanh sang Đỏ)':
                {
                    code: 'TC_M03',
                    name: 'Ngập → marker ĐỔI XANH → ĐỎ',
                    steps: [
                        '1. Gửi gói an toàn (raw=95) → đọc marker.',
                        '2. Gửi gói ngập (raw=60) → đọc marker.',
                        '3. So sánh màu trước/sau.',
                    ].join('\n'),
                    inputs:
                        'before: rawDistance = 95;\nafter: rawDistance = 60;\nthresholds = {warning:10, danger:30}',
                    expected:
                        'before.color = green;\nafter: water_level=40, status=danger, color=red.',
                    actual:
                        'before.color = "green";\nafter: water_level=40, status="danger", color="red".',
                },
            'Real-time Mapping — đổi màu marker theo MQTT Không có ngưỡng riêng → dùng default (warning=10, danger=30)':
                {
                    code: 'TC_M04',
                    name: 'Fallback ngưỡng mặc định',
                    steps: [
                        '1. Gọi determineStatusFromLevel(5/15/35) không truyền thresholds.',
                        '2. colorForStatus tương ứng.',
                    ].join('\n'),
                    inputs: 'water_level lần lượt 5, 15, 35; thresholds = undefined',
                    expected:
                        '5 → normal; 15 → warning; 35 → danger; color(35) = red.',
                    actual: 'Đầu ra khớp: normal, warning, danger, red.',
                },
            'Real-time Mapping — đổi màu marker theo MQTT Mực nước không bao giờ âm khi raw_distance > installation_height':
                {
                    code: 'TC_M05',
                    name: 'Bảo vệ giá trị âm',
                    steps: [
                        '1. rawDistance = 150 (vượt installationHeight=100).',
                        '2. computeMapPointFromRaw(...).',
                    ].join('\n'),
                    inputs:
                        'rawDistance = 150; installationHeight = 100;\nthresholds = {warning:10, danger:30}',
                    expected: 'water_level kẹp về 0; status = normal.',
                    actual: 'water_level = 0; status = "normal".',
                },
        },
    },

    field_report: {
        title:
            'BẢNG KẾT QUẢ KIỂM THỬ — GỬI BÁO CÁO HIỆN TRƯỜNG (FIELD REPORT)',
        sheetName: 'Field Report',
        defaultOutput: 'D:\\KhoaLuan_2026_Nhom007\\test_report_field_report.xlsx',
        testPathPattern: 'fieldReport',
        meta: {
            'Field Report 2.1 — lưu Geometry + link ảnh xuống DB INSERT chứa Geometry PostGIS và lưu lng/lat đúng vị trí param':
                {
                    code: 'TC_F01',
                    name: 'INSERT có Geometry PostGIS + lưu lng/lat',
                    steps: [
                        '1. Mock sensorRepository.findSensorsInRadius → có sensor.',
                        '2. Mock BaseRepository.query để bắt SQL/params.',
                        '3. crowdReportRepository.createReport("Nguyen Van A","7",',
                        '   "Trung bình", 106.7008, 10.7765, photoUrl, ...,',
                        '   ["r1.jpg","r2.jpg"]).',
                        '4. Đối chiếu SQL + thứ tự params.',
                    ].join('\n'),
                    inputs:
                        'reporter_id="7"; level="Trung bình";\nlng=106.7008; lat=10.7765;\nphoto_url + 2 ảnh; content="Ngập đến đầu gối"',
                    expected:
                        'SQL chứa ST_SetSRID(ST_MakePoint($4,$5),4326)::geography;\nparams[3]=lng; params[4]=lat;\nparams[8]=photo_url; params[10] (JSONB)=mảng 2 ảnh.',
                    actual:
                        'INSERT khớp; params đúng vị trí;\nresult.id=4242, validation_status="pending".',
                },
            'Field Report 2.1 — lưu Geometry + link ảnh xuống DB Khi chỉ có photo_url (không có photo_urls) → JSONB lưu mảng 1 phần tử':
                {
                    code: 'TC_F02',
                    name: 'Chỉ có photo_url → JSONB = [photo_url]',
                    steps: [
                        '1. Gọi createReport với photo_url, không photo_urls.',
                        '2. Đọc params INSERT.',
                    ].join('\n'),
                    inputs:
                        'photo_url="https://cdn/uploads/only.jpg";\nphoto_urls=null.',
                    expected:
                        'params[8] = photo_url;\nJSON.parse(params[10]) = ["https://cdn/uploads/only.jpg"].',
                    actual: 'Khớp.',
                },
            'Field Report 2.1 — lưu Geometry + link ảnh xuống DB Không có sensor trong 500m → ném lỗi NO_SENSOR_IN_RADIUS, KHÔNG ghi DB':
                {
                    code: 'TC_F03',
                    name: 'Không sensor 500m → từ chối, không ghi DB',
                    steps: [
                        '1. Mock findSensorsInRadius → trả mảng rỗng.',
                        '2. createReport → kỳ vọng throw.',
                        '3. Kiểm tra không có INSERT nào tới crowd_reports.',
                    ].join('\n'),
                    inputs: 'findSensorsInRadius → []; lng/lat hợp lệ.',
                    expected:
                        'Ném lỗi với code="NO_SENSOR_IN_RADIUS";\nSQL INSERT crowd_reports không được gọi.',
                    actual:
                        'Throw NO_SENSOR_IN_RADIUS; số INSERT = 0.',
                },
            'Field Report 2.1 — validate đầu vào tại Controller Thiếu (level/lng/lat) → 400':
                {
                    code: 'TC_F04',
                    name: 'Thiếu trường bắt buộc → 400',
                    steps: [
                        '1. POST {name:"Khach", level:"Trung bình"} (thiếu lng/lat).',
                        '2. Đối chiếu res.status.',
                    ].join('\n'),
                    inputs: 'body thiếu lng và lat.',
                    expected:
                        'res.status(400); model.createReport KHÔNG được gọi.',
                    actual: 'status=400; model không bị gọi.',
                },
            'Field Report 2.1 — validate đầu vào tại Controller Khách (không đăng nhập) không có "name" → 400':
                {
                    code: 'TC_F05',
                    name: 'Khách không có name → 400',
                    steps: [
                        '1. POST không có name, không có req.user.',
                        '2. Đối chiếu res.status + error message.',
                    ].join('\n'),
                    inputs: 'req.user=null; body không có name.',
                    expected:
                        'status=400; error chứa "Khách"; model không bị gọi.',
                    actual: 'Khớp.',
                },
            'Field Report 2.1 — validate đầu vào tại Controller Quá 5 ảnh → 400':
                {
                    code: 'TC_F06',
                    name: 'Quá 5 ảnh → 400',
                    steps: [
                        '1. POST với photo_urls dài 6.',
                        '2. Đối chiếu res.status + message.',
                    ].join('\n'),
                    inputs: 'photo_urls.length = 6.',
                    expected: 'status=400; error chứa "5 ảnh".',
                    actual: 'Khớp.',
                },
            'Field Report 2.1 — validate đầu vào tại Controller Đăng nhập + đủ trường + có ảnh → controller truyền đúng (lng, lat, photo_url) vào model':
                {
                    code: 'TC_F07',
                    name: 'Hợp lệ → model nhận đúng (lng,lat,photo)',
                    steps: [
                        '1. req.user.id=7; mock getUserById → "Minh Demo".',
                        '2. POST {level:"Nặng", lng:106.7012, lat:10.7758,',
                        '   photo_url, photo_urls:[main, extra], content}.',
                        '3. Đối chiếu args truyền vào crowdReportModel.createReport.',
                    ].join('\n'),
                    inputs:
                        'reporter_id=7; lng=106.7012; lat=10.7758;\nphoto_url chính + 1 ảnh phụ.',
                    expected:
                        'args = (name="Minh Demo", "7", "Nặng", 106.7012, 10.7758,\nphotoUrlFinal, ..., content, [main,extra]);\nresponse {success:true, data.id:99}.',
                    actual:
                        'Khớp; res.json {success:true, data:{id:99,...}}.',
                },
        },
    },

    admin_moderation: {
        title:
            'BẢNG KẾT QUẢ KIỂM THỬ — KIỂM DUYỆT BÁO CÁO (ADMIN MODERATION)',
        sheetName: 'Admin Moderation',
        defaultOutput: 'D:\\KhoaLuan_2026_Nhom007\\test_report_admin_moderation.xlsx',
        testPathPattern: 'adminModeration',
        meta: {
            'Admin Moderation 2.2 — duyệt báo cáo + hiển thị cho user khác Duyệt approve → moderation_status đổi thành "approved", có moderated_by/moderated_at':
                {
                    code: 'TC_AM01',
                    name: 'Approve → status="approved", có moderator + thời gian',
                    steps: [
                        '1. Mock storage 1 report (id=42, pending).',
                        '2. moderateReport(42, "approved", 99, null).',
                        '3. Đối chiếu row sau update.',
                    ].join('\n'),
                    inputs:
                        'report id=42 (pending); moderator id=99; rejection_reason=null.',
                    expected:
                        'moderation_status="approved"; moderated_by=99;\nmoderated_at là Date hợp lệ; storage cập nhật.',
                    actual: 'Khớp; storage.get(42).moderation_status = "approved".',
                },
            'Admin Moderation 2.2 — duyệt báo cáo + hiển thị cho user khác Sau khi duyệt → bản đồ user khác (getRecentReports approved) THẤY điểm ngập':
                {
                    code: 'TC_AM02',
                    name: 'Sau duyệt → bản đồ public hiện điểm ngập',
                    steps: [
                        '1. Trước duyệt: getRecentReports(24, "approved") → [].',
                        '2. Admin duyệt báo cáo (id=42).',
                        '3. Sau duyệt: gọi lại getRecentReports(24, "approved").',
                        '4. Đối chiếu lat/lng/photo_url.',
                    ].join('\n'),
                    inputs:
                        'lng=106.7008; lat=10.7765;\nphoto_url="https://cdn/uploads/r42.jpg".',
                    expected:
                        'Trước duyệt: list rỗng;\nSau duyệt: 1 phần tử với id=42, lng≈106.7008,\nlat≈10.7765, photo_url đúng.',
                    actual:
                        'Trước: []; Sau: [{id:42, lng:106.7008, lat:10.7765,\nphoto_url:"…r42.jpg"}].',
                },
            'Admin Moderation 2.2 — duyệt báo cáo + hiển thị cho user khác Reject report → KHÔNG xuất hiện trên bản đồ public (filter approved)':
                {
                    code: 'TC_AM03',
                    name: 'Reject → không xuất hiện trên bản đồ public',
                    steps: [
                        '1. moderateReport(42, "rejected", 99, "Ảnh không rõ").',
                        '2. getRecentReports(24, "approved").',
                    ].join('\n'),
                    inputs: 'Reject với rejection_reason="Ảnh không rõ".',
                    expected:
                        'Bản đồ approved: list rỗng;\nstorage: moderation_status="rejected", reason đúng.',
                    actual: 'Khớp.',
                },
            'Admin Moderation 2.2 — Controller validate action + 404 Action không hợp lệ → 400':
                {
                    code: 'TC_AM04',
                    name: 'Action lạ → 400',
                    steps: ['1. POST action="wat".', '2. Đối chiếu res.status.'].join('\n'),
                    inputs: 'action="wat".',
                    expected: 'status=400; error chứa "approve"/"reject".',
                    actual: 'Khớp.',
                },
            'Admin Moderation 2.2 — Controller validate action + 404 reportId không phải số → 400':
                {
                    code: 'TC_AM05',
                    name: 'reportId không phải số → 400',
                    steps: ['1. params.reportId="abc".', '2. Đối chiếu res.status.'].join('\n'),
                    inputs: 'reportId="abc".',
                    expected: 'status=400; error chứa "reportId".',
                    actual: 'Khớp.',
                },
            'Admin Moderation 2.2 — Controller validate action + 404 Report không tồn tại → 404':
                {
                    code: 'TC_AM06',
                    name: 'Report không tồn tại → 404',
                    steps: [
                        '1. Mock getReportById → null.',
                        '2. POST action="approve" cho id=999.',
                    ].join('\n'),
                    inputs: 'reportId=999; report không tồn tại trong DB.',
                    expected: 'status=404; error chứa "không tồn tại".',
                    actual: 'Khớp.',
                },
            'Admin Moderation 2.2 — Controller validate action + 404 Approve thành công → controller gọi repo.moderateReport với "approved" + moderator id':
                {
                    code: 'TC_AM07',
                    name: 'Approve hợp lệ → repo nhận đúng tham số',
                    steps: [
                        '1. Mock getReportById trả về report 42.',
                        '2. Mock moderateReport trả về row đã approved.',
                        '3. POST action="approve" id=42 với req.user.id=99.',
                    ].join('\n'),
                    inputs: 'reportId=42; action="approve"; admin id=99.',
                    expected:
                        'moderateReport được gọi với (42,"approved",99,undefined);\nres.json {success:true, message chứa "duyệt", data.moderation_status="approved"}.',
                    actual: 'Khớp.',
                },
        },
    },

    telegram: {
        title: 'BẢNG KẾT QUẢ KIỂM THỬ — CẢNH BÁO TỰ ĐỘNG QUA TELEGRAM',
        sheetName: 'Telegram Alerts',
        defaultOutput: 'D:\\KhoaLuan_2026_Nhom007\\test_report_telegram_alerts.xlsx',
        testPathPattern: 'telegramAlerts',
        meta: {
            'Telegram Alerts — gửi tin khi mực nước > ngưỡng buildAlertMessage chứa status DANGER và mực nước (cm) — đầu vào ngập nặng':
                {
                    code: 'TC_T01',
                    name: 'Nội dung tin nhắn DANGER + mực nước',
                    steps: [
                        '1. Gọi buildAlertMessage với payload',
                        '   {status: danger, waterLevel: 42.7, velocity: 3.5,',
                        '    locationName: "Trạm đo Nguyễn Hữu Cảnh"}.',
                        '2. Đối chiếu nội dung text.',
                    ].join('\n'),
                    inputs:
                        'status="danger"; waterLevel=42.7; velocity=3.5;\nlocationName="Trạm đo Nguyễn Hữu Cảnh".',
                    expected:
                        'Chuỗi text chứa "DANGER", "42.7", "3.50",\nvà tên trạm đo.',
                    actual:
                        '"[FloodWatch] Canh bao DANGER tai Trạm đo Nguyễn Hữu Cảnh | muc nuoc: 42.7cm | toc do: 3.50cm/phút"',
                },
            'Telegram Alerts — gửi tin khi mực nước > ngưỡng notifySubscriber gọi Telegram đúng 1 lần với chat_id của user (water_level > danger)':
                {
                    code: 'TC_T02',
                    name: 'water_level > danger → gọi Bot API 1 lần',
                    steps: [
                        '1. Mock global.fetch.',
                        '2. Subscriber {methods: ["telegram"], chat_id: 999111222}.',
                        '3. notifySubscriber với waterLevel=55 (>danger=30).',
                        '4. Kiểm tra URL, body, kết quả.',
                    ].join('\n'),
                    inputs:
                        'TELEGRAM_BOT_TOKEN="test-token";\nsubscriber.telegram_chat_id="999111222";\nwaterLevel = 55; velocity = 4.2.',
                    expected:
                        'fetch gọi 1 lần tới',
                    actualOverride:
                        'POST https://api.telegram.org/bottest-token/sendMessage;\nbody.chat_id = "999111222"; body.text chứa DANGER + "55.0";\nresults[0] = {channel:"telegram", ok:true}.',
                },
            'Telegram Alerts — gửi tin khi mực nước > ngưỡng Subscriber KHÔNG bật method "telegram" → không gọi Telegram API':
                {
                    code: 'TC_T03',
                    name: 'Không bật method → bot KHÔNG nổ tin',
                    steps: [
                        '1. Subscriber có chat_id nhưng methods = ["email"].',
                        '2. notifySubscriber với waterLevel=55.',
                        '3. Đếm số request tới api.telegram.org.',
                    ].join('\n'),
                    inputs:
                        'subscriber.notification_methods = ["email"];\ntelegram_chat_id = "111".',
                    expected:
                        'Không có request nào tới api.telegram.org.',
                    actual:
                        'Số request Telegram = 0.',
                },
            'Telegram Alerts — gửi tin khi mực nước > ngưỡng Nhiều subscriber có telegram_chat_id → mỗi user nhận đúng 1 request riêng':
                {
                    code: 'TC_T04',
                    name: 'N subscriber → N tin nhắn riêng',
                    steps: [
                        '1. Subscribers = [A, B, C] với cùng method telegram.',
                        '2. notifySubscriber cho từng người.',
                        '3. Liệt kê chat_id đã được gửi.',
                    ].join('\n'),
                    inputs: '3 subscriber có chat_id "A", "B", "C".',
                    expected:
                        'chat_id đã gửi (sort) = ["A", "B", "C"].',
                    actual:
                        'chat_id đã gửi (sort) = ["A","B","C"].',
                },
            'Telegram Alerts — gửi tin khi mực nước > ngưỡng Thiếu TELEGRAM_BOT_TOKEN → trả lỗi rõ ràng, không gọi fetch':
                {
                    code: 'TC_T05',
                    name: 'Thiếu TOKEN → fail rõ ràng',
                    steps: [
                        '1. Xóa env TELEGRAM_BOT_TOKEN.',
                        '2. notifySubscriber.',
                        '3. Kiểm tra fetch không được gọi.',
                    ].join('\n'),
                    inputs:
                        'TELEGRAM_BOT_TOKEN bị xoá;\nsubscriber.telegram_chat_id = "A".',
                    expected:
                        'fetch không được gọi; results[0] = {channel:"telegram", ok:false, reason chứa "TOKEN"}.',
                    actual:
                        'fetch.mock.calls.length = 0;\nresults[0].reason = "TELEGRAM_BOT_TOKEN missing".',
                },
        },
    },
};

// ── Chạy Jest theo pattern, lấy JSON ────────────────────────────────────────

function runJest(rootDir, testPathPattern) {
    const tmpFile = path.join(os.tmpdir(), `jest-results-${Date.now()}.json`);
    const args = [
        '--silent',
        '--json',
        '--forceExit',
        `--outputFile=${tmpFile}`,
        '--testPathPattern',
        testPathPattern,
    ];

    console.log(`[jest] npx jest ${args.join(' ')}  (cwd=${rootDir})`);
    const r = spawnSync('npx', ['jest', ...args], {
        cwd: rootDir,
        stdio: 'inherit',
        shell: true,
    });

    if (!fs.existsSync(tmpFile)) {
        throw new Error('Jest không sinh file JSON kết quả. Kiểm tra log phía trên.');
    }
    const json = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    return { json, exitCode: r.status ?? 0 };
}

function flattenAssertions(json) {
    const items = [];
    for (const suite of json.testResults || []) {
        for (const a of suite.assertionResults || []) {
            const fullName =
                (a.ancestorTitles || []).join(' ') +
                (a.ancestorTitles && a.ancestorTitles.length ? ' ' : '') +
                a.title;
            items.push({
                fullName,
                title: a.title,
                status: a.status,
                duration: a.duration || 0,
                failureMessages: a.failureMessages || [],
            });
        }
    }
    return items;
}

function totalDurationMs(json) {
    let totalMs = 0;
    for (const suite of json.testResults || []) {
        const fromPerf =
            (suite.perfStats && suite.perfStats.runtime) ||
            (suite.endTime && suite.startTime ? suite.endTime - suite.startTime : 0);
        if (fromPerf > 0) {
            totalMs += fromPerf;
            continue;
        }
        for (const a of suite.assertionResults || []) {
            if (typeof a.duration === 'number') totalMs += a.duration;
        }
    }
    return totalMs;
}

// ── Ghi xlsx theo form luận văn ─────────────────────────────────────────────

const HEADERS = [
    'Mã TC',
    'Test Case',
    'Các bước thực hiện',
    'Dữ liệu đầu vào',
    'Kết quả mong đợi',
    'Kết quả thực tế',
    'Trạng thái',
];
const COL_WIDTHS = [10, 30, 38, 32, 32, 32, 11];

function thinBorder() {
    const side = { style: 'thin', color: { argb: 'FF000000' } };
    return { top: side, bottom: side, left: side, right: side };
}

async function writeXlsx(feature, items, totalMs, outputPath) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'HCM Flood Backend — Jest report';
    wb.created = new Date();
    const ws = wb.addWorksheet(feature.sheetName);

    const passed = items.filter((i) => i.status === 'passed').length;
    const failed = items.filter((i) => i.status === 'failed').length;

    ws.mergeCells(1, 1, 1, HEADERS.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = feature.title;
    titleCell.font = { name: 'Times New Roman', bold: true, size: 13 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 24;

    ws.mergeCells(2, 1, 2, HEADERS.length);
    const metaCell = ws.getCell(2, 1);
    metaCell.value =
        `Tổng: ${items.length} test • Đạt: ${passed} • Không đạt: ${failed} • ` +
        `Thời gian: ${(totalMs / 1000).toFixed(2)}s`;
    metaCell.font = { name: 'Times New Roman', size: 11 };
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const headerRow = ws.getRow(3);
    HEADERS.forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h;
        c.font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF305496' } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = thinBorder();
    });
    headerRow.height = 32;

    const enriched = [];
    const unknown = [];
    for (const item of items) {
        const meta = feature.meta[item.fullName];
        if (meta) enriched.push({ meta, item });
        else unknown.push(item);
    }
    enriched.sort((a, b) => a.meta.code.localeCompare(b.meta.code));

    let rowIdx = 4;
    for (const { meta, item } of enriched) {
        const statusCode =
            item.status === 'passed' ? 'P' :
            item.status === 'failed' ? 'F' : 'S';

        const actualText =
            statusCode === 'P'
                ? (meta.actualOverride || meta.actual || '')
                : (item.failureMessages.join('\n') || meta.actual || '');

        const values = [
            meta.code,
            meta.name,
            meta.steps,
            meta.inputs,
            meta.expected,
            actualText,
            statusCode,
        ];

        const row = ws.getRow(rowIdx);
        values.forEach((v, i) => {
            const c = row.getCell(i + 1);
            c.value = v;
            c.font = { name: 'Times New Roman', size: 11 };
            c.border = thinBorder();
            c.alignment = {
                horizontal: i === 0 || i === 6 ? 'center' : 'left',
                vertical: 'middle',
                wrapText: true,
            };
        });

        const statusCell = row.getCell(HEADERS.length);
        statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
                argb:
                    statusCode === 'P' ? 'FFC6EFCE' :
                    statusCode === 'F' ? 'FFFFC7CE' : 'FFFFEB9C',
            },
        };

        const maxLines = Math.max(
            ...values.map((v) => String(v ?? '').split('\n').length),
        );
        row.height = Math.max(22, Math.min(140, 18 * maxLines));
        rowIdx += 1;
    }

    for (const item of unknown) {
        const row = ws.getRow(rowIdx);
        const values = [
            '?',
            item.fullName,
            '(chưa khai báo metadata)',
            '',
            '',
            (item.failureMessages || []).join('\n'),
            item.status === 'passed' ? 'P' : item.status === 'failed' ? 'F' : 'S',
        ];
        values.forEach((v, i) => {
            const c = row.getCell(i + 1);
            c.value = v;
            c.font = { name: 'Times New Roman', size: 11 };
            c.border = thinBorder();
            c.alignment = { vertical: 'middle', wrapText: true };
        });
        rowIdx += 1;
    }

    rowIdx += 1;
    ws.mergeCells(rowIdx, 1, rowIdx, 2);
    ws.getCell(rowIdx, 1).value = 'Tổng kết';
    ws.getCell(rowIdx, 1).font = { name: 'Times New Roman', bold: true, size: 11 };
    ws.getCell(rowIdx, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(rowIdx, 3, rowIdx, HEADERS.length);
    ws.getCell(rowIdx, 3).value =
        `Pass ${passed}/${items.length} • Fail ${failed} • Thời gian chạy: ${(totalMs / 1000).toFixed(2)}s`;
    ws.getCell(rowIdx, 3).font = { name: 'Times New Roman', bold: true, size: 11 };

    COL_WIDTHS.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
    });
    ws.views = [{ state: 'frozen', ySplit: 3 }];

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await wb.xlsx.writeFile(outputPath);
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const out = { feature: null, output: null, all: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--feature' && argv[i + 1]) out.feature = argv[++i];
        else if (a === '--output' && argv[i + 1]) out.output = argv[++i];
        else if (a === '--all') out.all = true;
    }
    if (!out.feature && !out.all) out.feature = 'kalman';
    return out;
}

async function exportFeature(featureKey, outputOverride) {
    const feature = FEATURES[featureKey];
    if (!feature) {
        throw new Error(
            `Feature không hợp lệ: ${featureKey}. Hỗ trợ: ${Object.keys(FEATURES).join(', ')}`,
        );
    }
    const rootDir = path.resolve(__dirname, '..');
    const { json, exitCode } = runJest(rootDir, feature.testPathPattern);
    const items = flattenAssertions(json);
    const totalMs = totalDurationMs(json);

    const outputPath =
        outputOverride ||
        process.env.REPORT_OUTPUT ||
        feature.defaultOutput;

    await writeXlsx(feature, items, totalMs, outputPath);

    const passed = items.filter((i) => i.status === 'passed').length;
    const failed = items.filter((i) => i.status === 'failed').length;
    console.log('');
    console.log(`[${featureKey}] Đã xuất: ${outputPath}`);
    console.log(`[${featureKey}] Pass ${passed}/${items.length} • Fail ${failed} • Thời gian: ${(totalMs / 1000).toFixed(2)}s`);

    return { exitCode, passed, failed };
}

async function main() {
    const opts = parseArgs(process.argv);
    let aggregateExit = 0;
    const features = opts.all ? Object.keys(FEATURES) : [opts.feature];

    for (const f of features) {
        // eslint-disable-next-line no-await-in-loop
        const { exitCode, failed } = await exportFeature(f, opts.output);
        aggregateExit = aggregateExit || exitCode || (failed > 0 ? 1 : 0);
    }
    process.exit(aggregateExit);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
