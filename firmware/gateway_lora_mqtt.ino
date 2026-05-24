/*
 * HCM Flood — Gateway LoRa → MQTT (trạm S01)
 * Nhận LoRa: S01,<distance_cm>
 * Gửi MQTT:  {"sensor_id":"S01","value":<distance_cm>}
 * BE tính water_level (installation_height − value) → FE
 *
 * Khớp lora_sensor_s01.ino: 433.175 MHz, SF7, BW 125kHz, SyncWord 0x34
 * Chân LoRa/OLED giống node: SS=5, RST=26, DIO0=4, SCK=18, MISO=19, MOSI=23, I2C 21/22
 */
#include <WiFi.h>
#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

#define LORA_SS 5
#define LORA_RST 26
#define LORA_DIO0 4
#define LORA_SCK 18
#define LORA_MISO 19
#define LORA_MOSI 23

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

const char* ssid = "Cafe Me Khuc";
const char* pass = "888888888";

const char* mqtt_server = "1af3004441454f2aabda930c941a552d.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "tram_cam_bien_1";
const char* mqtt_password = "Minh@2003";
const char* mqtt_topic = "hcm/flood/data";

const char* EXPECTED_SENSOR_ID = "S01";

WiFiClientSecure espClient;
PubSubClient mqtt_client(espClient);

void setupLoRa() {
  pinMode(LORA_RST, OUTPUT);
  digitalWrite(LORA_RST, LOW);
  delay(50);
  digitalWrite(LORA_RST, HIGH);
  delay(100);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(433175000)) {
    Serial.println("LoRa that bai!");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Loi: LoRa khong phan hoi");
    display.display();
    while (1) {
    }
  }

  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setSyncWord(0x34);
  LoRa.setTxPower(14);

  Serial.println("[GW] LoRa san sang — lang nghe S01 (433.175 MHz)");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("GW: Ready");
  display.print("Doi tram ");
  display.println(EXPECTED_SENSOR_ID);
  display.display();
}

void reconnectMQTT() {
  while (!mqtt_client.connected()) {
    Serial.print("Dang ket noi MQTT...");
    display.setCursor(0, 48);
    display.fillRect(0, 48, 128, 16, SSD1306_BLACK);
    display.print("MQTT Conn...");
    display.display();

    String clientId = "ESP32GW-";
    clientId += String(random(0xffff), HEX);

    if (mqtt_client.connect(clientId.c_str(), mqtt_user, mqtt_password)) {
      Serial.println(" Da ket noi MQTT!");
      display.fillRect(0, 48, 128, 16, SSD1306_BLACK);
      display.setCursor(0, 48);
      display.print("MQTT: OK");
      display.display();
    } else {
      Serial.print(" Loi rc=");
      Serial.print(mqtt_client.state());
      Serial.println(" thu lai sau 5s");
      delay(5000);
    }
  }
}

bool parseS01Payload(const String& receivedData, String& sensorId, int& distance) {
  int firstComma = receivedData.indexOf(',');
  if (firstComma <= 0) {
    return false;
  }

  sensorId = receivedData.substring(0, firstComma);
  sensorId.trim();

  int secondComma = receivedData.indexOf(',', firstComma + 1);
  if (secondComma > firstComma) {
    distance = receivedData.substring(firstComma + 1, secondComma).toInt();
  } else {
    distance = receivedData.substring(firstComma + 1).toInt();
  }

  return sensorId.length() > 0;
}

void showRxOnOled(const String& sensorId, int distance, int rssi) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("TRAM: ");
  display.println(sensorId);
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  display.setCursor(0, 20);
  display.print("Khoang cach: ");
  display.print(distance);
  display.println(" cm");
  display.setCursor(0, 56);
  display.print("RSSI:");
  display.print(rssi);
  display.print("dBm");
  display.display();
}

void sendMqttPacket(const String& receivedData, int rssi, float snr) {
  String sensorId;
  int distance = 0;

  Serial.print("RX LoRa: ");
  Serial.println(receivedData);

  if (!parseS01Payload(receivedData, sensorId, distance)) {
    Serial.println("[-] Sai dinh dang — can: S01,<cm>");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Loi dinh dang!");
    display.println(receivedData);
    display.display();
    return;
  }

  showRxOnOled(sensorId, distance, rssi);

  if (distance <= 0) {
    Serial.println("[-] Bo qua MQTT — khoang cach khong hop le");
    display.setCursor(0, 48);
    display.fillRect(0, 48, 128, 16, SSD1306_BLACK);
    display.setCursor(0, 48);
    display.print("Skip: loi do");
    display.display();
    return;
  }

  String payload = "{\"sensor_id\":\"" + sensorId + "\",\"value\":" + String(distance) + "}";

  Serial.print("[");
  Serial.print(sensorId);
  Serial.print("] distance: ");
  Serial.print(distance);
  Serial.print(" cm, RSSI: ");
  Serial.print(rssi);
  Serial.print(" dBm, SNR: ");
  Serial.println(snr);

  if (!mqtt_client.connected()) {
    Serial.println("[-] Mat ket noi MQTT, drop packet");
    display.setCursor(0, 48);
    display.fillRect(0, 48, 128, 16, SSD1306_BLACK);
    display.setCursor(0, 48);
    display.print("MQTT: OFF");
    display.display();
    return;
  }

  if (mqtt_client.publish(mqtt_topic, payload.c_str())) {
    display.setCursor(0, 48);
    display.fillRect(0, 48, 128, 16, SSD1306_BLACK);
    display.setCursor(0, 48);
    display.print("MQTT Pub: OK");
    display.display();
  } else {
    display.setCursor(0, 48);
    display.fillRect(0, 48, 128, 16, SSD1306_BLACK);
    display.setCursor(0, 48);
    display.print("MQTT Pub: FAIL");
    display.display();
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("OLED that bai!"));
    while (1) {
    }
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Gateway Starting...");
  display.display();

  randomSeed(analogRead(0));

  Serial.print("Connecting WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" WiFi OK");

  espClient.setInsecure();
  mqtt_client.setServer(mqtt_server, mqtt_port);

  setupLoRa();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt_client.connected()) {
      reconnectMQTT();
    }
    mqtt_client.loop();
  }

  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String receivedData = "";
    while (LoRa.available()) {
      receivedData += (char)LoRa.read();
    }

    int rssi = LoRa.packetRssi();
    float snr = LoRa.packetSnr();
    sendMqttPacket(receivedData, rssi, snr);
  }

  yield();
}
