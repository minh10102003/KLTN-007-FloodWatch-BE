/*
 * HCM Flood - Mạch cảm biến giả lập Wokwi — chỉ trạm S01
 * Gửi MQTT: sensor_id, value (raw_distance cm), temperature, humidity (DHT22).
 * BE hiển thị trực tiếp value (cm) làm mực nước trên FE.
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

#define DHT_PIN 4
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

const char* SENSOR_ID = "S01";
const char* LCD_NAME = "S01-Ng.Thai Son";

int fake_distance = 150;

LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClientSecure espClient;
PubSubClient client(espClient);

char mqttClientId[32];

void setup() {
  Serial.begin(115200);
  snprintf(mqttClientId, sizeof(mqttClientId), "ESP32_%s_HCM", SENSOR_ID);

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
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  fake_distance -= 5;
  if (fake_distance < 20) {
    fake_distance = 150;
    lcd.clear();
  }

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  lcd.setCursor(0, 0);
  lcd.print(LCD_NAME);
  lcd.setCursor(0, 1);
  lcd.print("cm:");
  lcd.print(fake_distance);
  lcd.print(" ");
  if (!isnan(temperature) && temperature >= -40 && temperature <= 80) {
    lcd.print(" T:");
    lcd.print((int)temperature);
    lcd.print("C");
  }
  lcd.print("   ");

  String payload = "{\"sensor_id\":\"" + String(SENSOR_ID) + "\",\"value\":" + String(fake_distance);
  if (!isnan(temperature) && temperature >= -40 && temperature <= 80) {
    payload += ",\"temperature\":" + String(temperature, 1);
  }
  if (!isnan(humidity) && humidity >= 0 && humidity <= 100) {
    payload += ",\"humidity\":" + String(humidity, 0);
  }
  payload += "}";

  Serial.print("[");
  Serial.print(SENSOR_ID);
  Serial.print("] value: ");
  Serial.print(fake_distance);
  Serial.print("cm");
  if (!isnan(temperature)) {
    Serial.print(", temp: ");
    Serial.print(temperature);
    Serial.print("C");
  }
  if (!isnan(humidity)) {
    Serial.print(", humidity: ");
    Serial.print(humidity);
    Serial.print("%");
  }
  Serial.println();

  client.publish("hcm/flood/data", payload.c_str());

  delay(3000);
}
