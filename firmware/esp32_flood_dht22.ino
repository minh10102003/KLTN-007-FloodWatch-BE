/*
 * HCM Flood - Mạch cảm biến giả lập (Wokwi) - 3 trạm + DHT22 (nhiệt độ, độ ẩm)
 * STATION_INDEX 0-2. Chạy 2-3 trạm: mở thêm tab Wokwi, mỗi project đặt STATION_INDEX khác nhau.
 * DHT22: Data nối GPIO DHT_PIN (mặc định 4).
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* mqtt_server = "1af3004441454f2aabda930c941a552d.s1.eu.hivemq.cloud";
const char* mqtt_user = "tram_cam_bien_1";
const char* mqtt_password = "Minh@2003";

const int TRIG_PIN = 5;
const int ECHO_PIN = 18;

// DHT22: Data pin (Wokwi nối SDA của DHT22 vào đây)
#define DHT_PIN 4
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

// ═══════════════════════════════════════════════════════════════════════════
// CHỌN TRẠM: Đổi số (0, 1 hoặc 2). Trạm 2-3: mở thêm tab Wokwi, đặt STATION_INDEX khác.
// ═══════════════════════════════════════════════════════════════════════════
#define STATION_INDEX 0

// Độ cao lắp đặt (cm) – phải khớp với installation_height trong DB
const int INSTALL_HEIGHT = 150;

// 3 trạm khả năng ngập cao nhất (sensor_id khớp bảng sensors trong DB)
struct StationConfig {
  const char* sensor_id;
  const char* lcd_name;    // Tên LCD (tối đa 16 ký tự)
};
const StationConfig STATIONS[] = {
  { "S01", "S01-Ng.Huu Canh" },  // 0: Nguyễn Hữu Cảnh - đoạn trũng cầu vượt
  { "S02", "S02-Binh Quoi P28" },// 1: Bình Quới (P.28) - triều cường, mưa
  { "S03", "S03-UVK-DBL-QL13" }  // 2: Ung Văn Khiêm, Đinh Bộ Lĩnh, QL13 - cửa ngõ ngập sâu
};
const int NUM_STATIONS = sizeof(STATIONS) / sizeof(STATIONS[0]);

// Tự động lấy cấu hình trạm hiện tại (giới hạn index hợp lệ)
const StationConfig* station = &STATIONS[STATION_INDEX < NUM_STATIONS ? STATION_INDEX : 0];

// Biến mô phỏng
int fake_distance = 150;

LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClientSecure espClient;
PubSubClient client(espClient);

// Client ID MQTT phải khác nhau cho mỗi trạm khi chạy nhiều simulation
char mqttClientId[32];

void setup() {
  Serial.begin(115200);
  snprintf(mqttClientId, sizeof(mqttClientId), "ESP32_%s_HCM", station->sensor_id);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("DANG KET NOI...");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  dht.begin();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");
  lcd.setCursor(0, 1);
  lcd.print("WiFi OK!        ");
  delay(1000);
  lcd.clear();

  espClient.setInsecure();
  client.setServer(mqtt_server, 8883);
}

void reconnect() {
  while (!client.connected()) {
    lcd.setCursor(0, 0);
    lcd.print("MQTT Connecting");
    if (client.connect(mqttClientId, mqtt_user, mqtt_password)) {
      Serial.println("Connected to HiveMQ");
      lcd.clear();
    } else {
      lcd.setCursor(0, 1);
      lcd.print("Failed! Retrying");
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) { reconnect(); }
  client.loop();

  fake_distance -= 5;
  if (fake_distance < 20) {
    fake_distance = 150;
    lcd.clear();
  }

  int water_level = INSTALL_HEIGHT - fake_distance;
  if (water_level < 0) water_level = 0;

  // Đọc DHT22 (nhiệt độ °C, độ ẩm %)
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  lcd.setCursor(0, 0);
  lcd.print(station->lcd_name);
  lcd.setCursor(0, 1);
  lcd.print("MUC:");
  lcd.print(water_level);
  lcd.print("cm");
  if (!isnan(temperature) && temperature >= -40 && temperature <= 80) {
    lcd.print(" T:");
    lcd.print((int)temperature);
    lcd.print("C");
  }
  lcd.print("   ");

  // Payload: value = raw_distance (tương thích BE), temperature và humidity (optional)
  String payload = "{\"sensor_id\":\"" + String(station->sensor_id) + "\",\"value\":" + String(fake_distance);
  if (!isnan(temperature) && temperature >= -40 && temperature <= 80) {
    payload += ",\"temperature\":" + String(temperature, 1);
  }
  if (!isnan(humidity) && humidity >= 0 && humidity <= 100) {
    payload += ",\"humidity\":" + String(humidity, 0);
  }
  payload += "}";

  Serial.print("["); Serial.print(station->sensor_id); Serial.print("] raw_distance: ");
  Serial.print(fake_distance); Serial.print("cm, water_level: "); Serial.print(water_level);
  Serial.print("cm"); if (!isnan(temperature)) { Serial.print(", temp: "); Serial.print(temperature); Serial.print("C"); }
  if (!isnan(humidity)) { Serial.print(", humidity: "); Serial.print(humidity); Serial.print("%"); }
  Serial.println();

  client.publish("hcm/flood/data", payload.c_str());

  delay(3000);
}
