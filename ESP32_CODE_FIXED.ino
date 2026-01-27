#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <LiquidCrystal_I2C.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* mqtt_server = "1af3004441454f2aabda930c941a552d.s1.eu.hivemq.cloud";
const char* mqtt_user = "tram_cam_bien_1";
const char* mqtt_password = "Minh@2003";

const int TRIG_PIN = 5;
const int ECHO_PIN = 18;

// NGHIỆP VỤ: Cấu hình độ cao lắp đặt 150cm
const int INSTALL_HEIGHT = 150; 

// Biến phục vụ mô phỏng tự động
int fake_distance = 150; // Bắt đầu ở mức nước cạn (khoảng cách tới mặt nước bằng độ cao lắp đặt)

LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClientSecure espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("DANG KET NOI...");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
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
    if (client.connect("ESP32_S01_HCM", mqtt_user, mqtt_password)) {
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

  // 1. NGHIỆP VỤ: TỰ ĐỘNG MÔ PHỎNG (Auto-simulation)
  // Mỗi vòng lặp, nước dâng lên 5cm (khoảng cách fake_distance giảm đi 5cm)
  fake_distance -= 5;  
  if (fake_distance < 20) {
    fake_distance = 150; // Khi nước dâng quá cao (cách cảm biến 20cm), reset về mức cạn
    lcd.clear(); // Xóa màn hình để chuẩn bị chu kỳ mới
  }

  // 2. NGHIỆP VỤ: Tính mực nước thực tế (chỉ để hiển thị LCD)
  // Mực nước = Độ cao lắp đặt - Khoảng cách đo được (mô phỏng)
  int water_level = INSTALL_HEIGHT - fake_distance;
  if (water_level < 0) water_level = 0; 

  // 3. HIỂN THỊ LCD (Giám sát tại chỗ)
  lcd.setCursor(0, 0);
  lcd.print("TRAM: S01 - HCM ");
  lcd.setCursor(0, 1);
  lcd.print("MUC NUOC: ");
  lcd.print(water_level);
  lcd.print("cm   "); 

  // 4. GỬI DATA LÊN CLOUD (JSON chuẩn cho Backend)
  // ⚠️ QUAN TRỌNG: Gửi raw_distance (khoảng cách đo được), KHÔNG phải water_level
  // Backend sẽ tự tính: water_level = installation_height - raw_distance
  String payload = "{\"sensor_id\": \"S01\", \"value\":" + String(fake_distance) + "}";
  Serial.print("Simulating Flood - Sending raw_distance: "); 
  Serial.print(fake_distance);
  Serial.print("cm (water_level on LCD: ");
  Serial.print(water_level);
  Serial.println("cm)");
  
  client.publish("hcm/flood/data", payload.c_str());
  
  delay(3000); // Gửi dữ liệu mỗi 3 giây
}
