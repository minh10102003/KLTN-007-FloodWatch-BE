/**
 * Sensor Node — HC-SR04 + LoRa Ra-02 (SX127x) P2P
 *
 * Gửi JSON qua LoRa (Gateway sẽ forward lên MQTT hcm/flood/data).
 * Payload khớp backend: sensor_id + value (khoảng cách siêu âm, cm).
 *
 * CHÂN theo sơ đồ nguyên lý mạch NODE (Hình 7):
 *   LoRa: NSS15, SCK18, MOSI23, MISO19, RST26, DIO0 4 (DIO1=14, lib không cần)
 *   HC-SR04: TRIG27, ECHO13 (sơ đồ có chia áp 5V→3.3V cho Echo — bắt buộc đúng mạch)
 *   OLED I2C: SDA21, SCL22
 *
 * Lưu ý: Gateway (Hình 8) dùng NSS=5; Node dùng NSS=15 — khác nhau theo PCB, không sai.
 *
 * OLED (tùy chọn): SDA21 SCL22 — đặt USE_OLED 1
 *
 * Thư viện: LoRa (Sandeep Mistry)
 *          + Adafruit SSD1306 + GFX nếu USE_OLED
 */

#include <SPI.h>
#include <LoRa.h>

// ========== CẤU HÌNH TRẠM ==========
#define SENSOR_ID        "S01"          // Trùng sensors.sensor_id trong PostgreSQL
#define MEASURE_INTERVAL_MS  10000      // Gửi mỗi 10s (tăng khi dùng deep sleep)
#define USE_DEEP_SLEEP   0             // 1: ngủ 5 phút sau mỗi lần gửi (tiết kiệm pin)
#define DEEP_SLEEP_SEC   300

// ========== LORA — Hình 7 (Node) ==========
// Đặt 1 khi thử nối dây CS module sang GPIO5 (tách khỏi 15) để loại lỗi strapping GPIO15
#define LORA_NSS_USE_GPIO5_DEBUG  0
#if LORA_NSS_USE_GPIO5_DEBUG
#define LORA_NSS   5
#else
#define LORA_NSS   15
#endif
#define LORA_RST   26
#define LORA_DIO0  4
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23

const long LORA_FREQ      = 433E6;
const int  LORA_SF        = 7;
const long LORA_BW        = 125E3;
const int  LORA_CR        = 5;
const int  LORA_SYNC      = 0x12;
const int  LORA_TX_DBM    = 17;

/** 1: đảo tham số MISO/MOSI trong SPI.begin (thử khi VERSION=0x00 mà dây PCB đảo) */
#define LORA_SPI_SWAP_MISO_MOSI  0

// Thử thêm tần nếu begin fail nhưng VERSION đã 0x12 (module 868 MHz)
#define TRY_LORA_FREQ_868  1

// ========== HC-SR04 — Hình 7 ==========
#define TRIG_PIN   27
#define ECHO_PIN   13

// ========== OLED ==========
#define USE_OLED   0
#define OLED_SDA   21
#define OLED_SCL   22
#define OLED_ADDR  0x3C
#define SCREEN_W   128
#define SCREEN_H   64

#if USE_OLED
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, -1);
#endif

static const SPISettings LORA_SPI_SETTINGS(1000000, MSBFIRST, SPI_MODE0);

/** ESP32 SPI.begin(SCK, MISO, MOSI, SS) */
static void loraAttachSpiBus(bool swapMisoMosi) {
  if (swapMisoMosi) {
    SPI.begin(LORA_SCK, LORA_MOSI, LORA_MISO, LORA_NSS);
  } else {
    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  }
#if defined(ESP32) || defined(ARDUINO_ARCH_ESP32)
  LoRa.setSPI(SPI);
#endif
}

/** Đọc thanh ghi VERSION (0x12 = SX127x). In Serial để debug nếu begin FAIL. */
uint8_t sxReadVersion() {
  digitalWrite(LORA_NSS, LOW);
  SPI.beginTransaction(LORA_SPI_SETTINGS);
  SPI.transfer(0x42u | 0x80u);
  uint8_t v = SPI.transfer(0x00);
  SPI.endTransaction();
  digitalWrite(LORA_NSS, HIGH);
  return v;
}

static void printVersionHex(uint8_t ver) {
  Serial.print("LoRa VERSION reg = 0x");
  if (ver < 16) Serial.print('0');
  Serial.print(ver, HEX);
  Serial.println(" (need 0x12)");
  Serial.flush();
}

bool setupLoRa() {
  pinMode(LORA_NSS, OUTPUT);
  digitalWrite(LORA_NSS, HIGH);
  pinMode(LORA_RST, OUTPUT);
  digitalWrite(LORA_RST, LOW);
  delay(20);
  digitalWrite(LORA_RST, HIGH);
  delay(50);

  /* Thử cả 2 cách map MISO/MOSI trong SPI.begin (luôn cả hai nếu lần đầu 0x00) */
  const bool preferSwap = (LORA_SPI_SWAP_MISO_MOSI != 0);
  uint8_t ver = 0;

  loraAttachSpiBus(preferSwap);
  ver = sxReadVersion();
  Serial.print(preferSwap ? "SPI (swap first) " : "SPI (normal first) ");
  printVersionHex(ver);

  if (ver != 0x12) {
    Serial.println("Retry: other MISO/MOSI mapping...");
    Serial.flush();
    loraAttachSpiBus(!preferSwap);
    ver = sxReadVersion();
    Serial.print("SPI (2nd try) ");
    printVersionHex(ver);
  }

  if (ver != 0x12) {
    Serial.println("SPI FAIL: doc VERSION luon 0x00.");
    Serial.println("- Do day: MISO=GPIO19, MOSI=23, SCK=18, NSS=15, RST=26, GND chung");
    Serial.println("- Do nguon: 3V3 tai module LoRa (do khi chay)");
    Serial.println("- Dat LORA_NSS_USE_GPIO5_DEBUG 1, noi CS module -> GPIO5 (ngat khoi 15), nap lai");
    Serial.println("- Module Ra-02 loi / han long chan");
    Serial.flush();
    return false;
  }

  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);
  LoRa.setSPIFrequency(1000000);

  bool radioOk = LoRa.begin(LORA_FREQ);
#if TRY_LORA_FREQ_868
  if (!radioOk && LORA_FREQ != 868E6) {
    Serial.println("LoRa.begin 433 FAIL, try 868 MHz...");
    Serial.flush();
    radioOk = LoRa.begin(868E6);
  }
#endif
  if (!radioOk) {
    Serial.println("LoRa begin FAIL");
    Serial.flush();
    return false;
  }
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setSignalBandwidth(LORA_BW);
  LoRa.setCodingRate4(LORA_CR);
  LoRa.setSyncWord(LORA_SYNC);
  LoRa.setTxPower(LORA_TX_DBM);
  LoRa.enableCrc();
  Serial.println("LoRa TX ready");
  return true;
}

/** Trả về khoảng cách cm; <0 nếu lỗi */
float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);
  if (us == 0) return -1.0f;
  return (us * 0.0343f) / 2.0f;
}

bool sendJsonLoRa(const char* json, size_t len) {
  LoRa.beginPacket();
  LoRa.write((const uint8_t*)json, len);
  return LoRa.endPacket();
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("Sensor Node LoRa");
  Serial.flush();

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

#if USE_OLED
  Wire.begin(OLED_SDA, OLED_SCL);
  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Node " SENSOR_ID);
    display.display();
  }
#endif

  if (!setupLoRa()) {
    Serial.println("STOP: LoRa");
#if USE_OLED
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("LoRa FAIL");
    display.display();
#endif
    while (true) delay(1000);
  }

#if USE_OLED
  display.setCursor(0, 16);
  display.println("LoRa OK");
  display.display();
#endif
}

void loop() {
  float d = readDistanceCm();
  if (d < 0 || d > 500) {
    d = 0;
  }

  char payload[160];
  int n = snprintf(payload, sizeof(payload),
                   "{\"sensor_id\":\"%s\",\"value\":%.2f}",
                   SENSOR_ID, d);
  if (n <= 0 || (size_t)n >= sizeof(payload)) {
    Serial.println("payload overflow");
    delay(MEASURE_INTERVAL_MS);
    return;
  }
  size_t len = (size_t)n;

  Serial.printf("TX %s\n", payload);

  if (sendJsonLoRa(payload, len)) {
    Serial.println("LoRa send OK");
  } else {
    Serial.println("LoRa send FAIL");
  }

#if USE_OLED
  display.clearDisplay();
  display.setCursor(0, 0);
  display.printf("%s\n", SENSOR_ID);
  display.printf("dist %.1f cm\n", d);
  display.display();
#endif

#if USE_DEEP_SLEEP
  LoRa.end();
  SPI.end();
  esp_sleep_enable_timer_wakeup((uint64_t)DEEP_SLEEP_SEC * 1000000ULL);
  esp_deep_sleep_start();
#else
  delay(MEASURE_INTERVAL_MS);
#endif
}
