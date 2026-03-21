/**
 * Gateway: LoRa RX -> HiveMQ MQTTS -> topic hcm/flood/data
 *
 * Phần cứng (sơ đồ Gateway): NSS5 RST26 DIO0 4 | SCK18 MISO19 MOSI23
 * OLED I2C: SDA21 SCL22 (0x3C)
 *
 * Thư viện Arduino: LoRa (Sandeep Mistry), PubSubClient,
 *                   Adafruit SSD1306, Adafruit GFX
 *
 * Cấu hình WiFi/MQTT: sửa trong khối bên dưới (không commit mật khẩu lên git).
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ================== CHÂN ==================
#define LORA_NSS   5
#define LORA_RST   26
#define LORA_DIO0  4
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23

#define OLED_SDA   21
#define OLED_SCL   22
#define OLED_ADDR  0x3C
#define SCREEN_W   128
#define SCREEN_H   64

#define REG_VERSION       0x42
#define RUN_LORA_SELF_TEST  true
#define HALT_IF_LORA_FAIL   true

// ================== WIFI / MQTT ==================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_HOST     = "YOUR.hivemq.cloud.host";
const uint16_t MQTT_PORT  = 8883;
const char* MQTT_USER     = "your_mqtt_user";
const char* MQTT_PASSWORD = "your_mqtt_password";

const char* MQTT_TOPIC    = "hcm/flood/data";

const long LORA_FREQ      = 433E6;
const int   LORA_SF       = 7;
const long  LORA_BW       = 125E3;
const int   LORA_CR       = 5;
const int   LORA_SYNC     = 0x12;
const int   LORA_TX_DBM   = 17;

static const SPISettings LORA_SPI_SETTINGS(1000000, MSBFIRST, SPI_MODE0);

// ================== GLOBAL ==================
WiFiClientSecure secureClient;
PubSubClient mqtt(secureClient);
Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, -1);

bool g_oledOk = false;
String line1 = "GW";
String line2 = "";
String line3 = "";
unsigned long lastOledMs = 0;

static void loraAttachSpiBus() {
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
#if defined(ESP32) || defined(ARDUINO_ARCH_ESP32)
  LoRa.setSPI(SPI);
#endif
}

void oledShow() {
  if (!g_oledOk) return;
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(line1);
  display.println(line2);
  display.println(line3);
  display.display();
}

void oledTick() {
  if (!g_oledOk) return;
  if (millis() - lastOledMs < 400) return;
  lastOledMs = millis();
  oledShow();
}

bool setupOled() {
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED: skip");
    g_oledOk = false;
    return false;
  }
  g_oledOk = true;
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Flood GW");
  display.display();
  return true;
}

// SX127x READ: MSB=1 (đúng datasheet + thư viện LoRa.cpp)
uint8_t sxReadReg(uint8_t reg) {
  uint8_t v;
  digitalWrite(LORA_NSS, LOW);
  SPI.beginTransaction(LORA_SPI_SETTINGS);
  SPI.transfer(reg | 0x80);
  v = SPI.transfer(0x00);
  SPI.endTransaction();
  digitalWrite(LORA_NSS, HIGH);
  return v;
}

void sxHardwareReset() {
  pinMode(LORA_RST, OUTPUT);
  digitalWrite(LORA_RST, LOW);
  delay(20);
  digitalWrite(LORA_RST, HIGH);
  delay(50);
}

bool loraSelfTestSpi() {
  Serial.println("=== LORA SELF-TEST ===");
  pinMode(LORA_NSS, OUTPUT);
  digitalWrite(LORA_NSS, HIGH);
  sxHardwareReset();
  Serial.println("[T1] RST pulse: OK");

  loraAttachSpiBus();

  uint8_t ver = sxReadReg(REG_VERSION);
  Serial.printf("[T2] VERSION = 0x%02X", ver);
  if (ver == 0x12) {
    Serial.println(" OK (SX127x)");
    line2 = "LoRa SPI OK";
    line3 = "Ver 0x12";
    oledShow();
    return true;
  }
  Serial.println(" FAIL");
  line2 = "LoRa SPI FAIL";
  line3 = "MISO/NSS/GND?";
  oledShow();
  return false;
}

bool loraSelfTestRadio() {
  loraAttachSpiBus();
  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);
  LoRa.setSPIFrequency(1000000);

  if (!LoRa.begin(LORA_FREQ)) {
    Serial.printf("[T3] LoRa.begin FAIL\n");
    line2 = "begin FAIL";
    line3 = "Try 868E6";
    oledShow();
    return false;
  }
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setSignalBandwidth(LORA_BW);
  LoRa.setCodingRate4(LORA_CR);
  LoRa.setSyncWord(LORA_SYNC);
  LoRa.setTxPower(LORA_TX_DBM);
  LoRa.enableCrc();

  LoRa.beginPacket();
  LoRa.print("GW_TEST");
  Serial.printf("[T4] TX test: %s\n", LoRa.endPacket() ? "OK" : "FAIL");

  line2 = "LoRa OK";
  line3 = "MQTT next";
  oledShow();
  Serial.println("=== SELF-TEST PASS ===\n");
  return true;
}

void setupWiFi() {
  line2 = "WiFi...";
  oledShow();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
    oledTick();
  }
  line1 = "WiFi OK";
  line2 = WiFi.localIP().toString();
  line3 = "";
  oledShow();
  Serial.printf("\nWiFi OK %s\n", line2.c_str());
}

void mqttReconnect() {
  line3 = "MQTT...";
  oledShow();
  while (!mqtt.connected()) {
    String cid = "gw-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (mqtt.connect(cid.c_str(), MQTT_USER, MQTT_PASSWORD)) {
      line3 = "MQTT OK";
      oledShow();
    } else {
      Serial.printf("MQTT fail %d\n", mqtt.state());
      line3 = "MQTT " + String(mqtt.state());
      oledShow();
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1200);

  setupOled();
  line1 = "Flood Gateway";
  line2 = "Boot";
  oledShow();

  if (RUN_LORA_SELF_TEST) {
    if (!loraSelfTestSpi()) {
      Serial.println("SPI fail: check MISO->GPIO19, MOSI->23, SCK->18, NSS->5, RST->26, GND, 3V3");
      if (HALT_IF_LORA_FAIL) {
        line1 = "STOP";
        line2 = "LoRa SPI";
        line3 = "FAIL";
        oledShow();
        while (true) delay(1000);
      }
    } else if (!loraSelfTestRadio()) {
      if (HALT_IF_LORA_FAIL) {
        line1 = "STOP";
        line2 = "LoRa RF";
        line3 = "FAIL";
        oledShow();
        while (true) delay(1000);
      }
    }
  } else {
    loraAttachSpiBus();
    LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);
    LoRa.setSPIFrequency(1000000);
    if (!LoRa.begin(LORA_FREQ)) {
      while (true) delay(1000);
    }
    LoRa.setSpreadingFactor(LORA_SF);
    LoRa.setSignalBandwidth(LORA_BW);
    LoRa.setCodingRate4(LORA_CR);
    LoRa.setSyncWord(LORA_SYNC);
    LoRa.setTxPower(LORA_TX_DBM);
    LoRa.enableCrc();
  }

  setupWiFi();
  secureClient.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);
  mqttReconnect();

  line1 = "GW Running";
  line2 = "LoRa->MQTT";
  line3 = "Wait RX";
  oledShow();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }
  if (!mqtt.connected()) {
    mqttReconnect();
  }
  mqtt.loop();

  int n = LoRa.parsePacket();
  if (n) {
    String s;
    s.reserve(n + 8);
    while (LoRa.available()) {
      s += (char)LoRa.read();
    }
    s.trim();
    int rssi = LoRa.packetRssi();
    Serial.printf("LoRa RX (%d B, RSSI %d): %s\n", n, rssi, s.c_str());
    line3 = "RSSI " + String(rssi);
    oledShow();
    if (s.length() > 0) {
      mqtt.publish(MQTT_TOPIC, s.c_str());
      line2 = "MQTT sent";
      line1 = s.substring(0, min(16, (int)s.length()));
      oledShow();
    }
  }
  oledTick();
}
