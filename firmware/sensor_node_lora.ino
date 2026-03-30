/**
 * Node cảm biến — HC-SR04 + LoRa → Gateway → MQTT → Backend
 *
 * CẢNH BÁO NGẬP LỤT — NHÓM 007
 *
 * Lắp đặt: cảm biến cách mặt đất (mốc tham chiếu) = INSTALLATION_HEIGHT_CM (vd. 100 cm).
 * Đo được: khoảng cách từ cảm biến xuống mặt nước = D (cm).
 *
 * Mực nước (độ sâu/ngập so mốc): H = INSTALLATION_HEIGHT_CM - D  (H >= 0).
 * Firmware gửi JSON chỉ field "value" = D (đã lọc). Backend lấy installation_height
 * từ PostgreSQL và tính lại water_level — phải khớp INSTALLATION_HEIGHT_CM với cột đó.
 *
 * CHÂN PCB đang chạy (Node):
 *   LoRa: NSS15 RST26 DIO04 | SCK18 MISO19 MOSI32
 *   HC-SR04: TRIG27 ECHO13 (chia áp Echo 5V→3.3V nếu cần)
 *   OLED I2C: SDA21 SCL22 0x3C
 *
 * Thư viện: LoRa (Sandeep Mistry), Adafruit SSD1306 + GFX
 */

#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ========== PHẢI KHỚP DB: sensors.installation_height cho SENSOR_ID ==========
#define SENSOR_ID               "S01"
#define INSTALLATION_HEIGHT_CM  100.0f   // Độ cao lắp cảm biến so mặt đất/mốc (cm)

#define WINDOW_SIZE             8        // Moving average (sliding window)
#define MEASURE_INTERVAL_MS     3000

// ========== CHÂN ==========
#define LORA_NSS   15
#define LORA_RST   26
#define LORA_DIO0  4
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  32

#define TRIG_PIN   27
#define ECHO_PIN   13

#define OLED_SDA   21
#define OLED_SCL   22
#define OLED_ADDR  0x3C
#define SCREEN_W   128
#define SCREEN_H   64

const long LORA_FREQ   = 433E6;
const int  LORA_SF     = 7;
const long LORA_BW     = 125E3;
const int  LORA_CR     = 5;
const int  LORA_SYNC   = 0x12;
const int  LORA_TX_DBM = 17;

#define TRY_LORA_FREQ_868  1

static const SPISettings LORA_SPI_SETTINGS(1000000, MSBFIRST, SPI_MODE0);

Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, -1);

// ========== Moving average: chỉ nhập mẫu hợp lệ; giữ giá trị lọc cuối khi mẫu lỗi ==========
static float g_buf[WINDOW_SIZE];
static int g_ptr = 0;
static int g_count = 0;
static double g_sum = 0;
static float g_lastFiltered = NAN;  // khoảng cách D (cm) đã lọc

static float movingAveragePush(float dCm) {
  if (dCm <= 0 || dCm > 500.0f) {
    return isnan(g_lastFiltered) ? NAN : g_lastFiltered;
  }
  if (g_count == WINDOW_SIZE) {
    g_sum -= (double)g_buf[g_ptr];
  } else {
    g_count++;
  }
  g_buf[g_ptr] = dCm;
  g_sum += (double)dCm;
  g_ptr = (g_ptr + 1) % WINDOW_SIZE;
  g_lastFiltered = (float)(g_sum / (double)g_count);
  return g_lastFiltered;
}

/** Khoảng cách cảm biến → mặt nước (cm); <0 nếu timeout/lỗi */
static float measureDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);
  if (us == 0) return -1.0f;
  return (us * 0.0343f) / 2.0f;
}

/** Mực nước hiển thị / kiểm tra: H = H_install - D (cùng công thức backend) */
static float waterLevelFromDistance(float dCm) {
  if (isnan(dCm) || dCm <= 0) return 0.0f;
  float h = INSTALLATION_HEIGHT_CM - dCm;
  return h < 0 ? 0.0f : h;
}

static uint8_t sxReadVersion() {
  digitalWrite(LORA_NSS, LOW);
  SPI.beginTransaction(LORA_SPI_SETTINGS);
  SPI.transfer(0x42u | 0x80u);
  uint8_t v = SPI.transfer(0x00);
  SPI.endTransaction();
  digitalWrite(LORA_NSS, HIGH);
  return v;
}

static bool setupLoRa() {
  pinMode(LORA_NSS, OUTPUT);
  digitalWrite(LORA_NSS, HIGH);
  pinMode(LORA_RST, OUTPUT);
  digitalWrite(LORA_RST, LOW);
  delay(20);
  digitalWrite(LORA_RST, HIGH);
  delay(50);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
#if defined(ESP32) || defined(ARDUINO_ARCH_ESP32)
  LoRa.setSPI(SPI);
#endif

  uint8_t ver = sxReadVersion();
  if (ver != 0x12) {
    Serial.println("LoRa: thử đổi MISO/MOSI...");
    SPI.begin(LORA_SCK, LORA_MOSI, LORA_MISO, LORA_NSS);
    LoRa.setSPI(SPI);
    ver = sxReadVersion();
  }
  if (ver != 0x12) {
    Serial.println("LoRa VERSION fail (need 0x12). Kiểm tra dây SPI/NSS.");
    return false;
  }

  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);
  LoRa.setSPIFrequency(1000000);

  bool ok = LoRa.begin(LORA_FREQ);
#if TRY_LORA_FREQ_868
  if (!ok && LORA_FREQ != 868E6) {
    ok = LoRa.begin(868E6);
  }
#endif
  if (!ok) return false;

  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setSignalBandwidth(LORA_BW);
  LoRa.setCodingRate4(LORA_CR);
  LoRa.setSyncWord(LORA_SYNC);
  LoRa.setTxPower(LORA_TX_DBM);
  LoRa.enableCrc();
  return true;
}

static bool sendJsonLoRa(const char* json, size_t len) {
  LoRa.beginPacket();
  LoRa.write((const uint8_t*)json, len);
  return LoRa.endPacket();
}

void setup() {
  Serial.begin(115200);
  delay(800);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED fail");
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Khoi dong...");
  display.display();

  if (!setupLoRa()) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("LoRa LOI");
    display.display();
    while (1) delay(1000);
  }

  Serial.println("--- Node san sang ---");
}

void loop() {
  float raw = measureDistanceCm();
  float dFiltered = movingAveragePush(raw);
  float waterLocal = waterLevelFromDistance(dFiltered);

  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.printf("TRAM: %s", SENSOR_ID);
  display.setCursor(0, 12);
  if (isnan(dFiltered)) {
    display.println("Khoang cach: ---");
    display.setCursor(0, 28);
    display.println("Cho do hop le...");
  } else {
    display.printf("K.cach: %.1f cm", dFiltered);
    display.setTextSize(2);
    display.setCursor(0, 32);
    display.printf("%d cm", (int)(waterLocal + 0.5f));
    display.setTextSize(1);
    display.setCursor(0, 56);
    display.println("muc nuoc (H)");
  }
  display.display();

  if (!isnan(dFiltered) && dFiltered > 0 && dFiltered <= 500.0f) {
    char payload[140];
    int n = snprintf(payload, sizeof(payload),
                     "{\"sensor_id\":\"%s\",\"value\":%.2f}", SENSOR_ID, dFiltered);
    if (n > 0 && (size_t)n < sizeof(payload)) {
      Serial.print("TX LoRa: ");
      Serial.println(payload);
      if (sendJsonLoRa(payload, (size_t)n)) {
        Serial.println("LoRa OK");
      } else {
        Serial.println("LoRa FAIL");
      }
    }
  } else {
    Serial.println("Bo qua TX (chua co D hop le — backend tu choi value<=0)");
  }

  delay(MEASURE_INTERVAL_MS);
}
