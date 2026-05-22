#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==========================================
// CẤU HÌNH MÀN HÌNH OLED 0.96 INCH
// ==========================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==========================================
// THÔNG SỐ CẢM BIẾN JSN-SR04T & LOGIC BE
// ==========================================
const int TRIG_PIN = 27;
const int ECHO_PIN = 13;

// ĐỒNG BỘ THÔNG SỐ VỚI BACKEND
const float INSTALLATION_HEIGHT = 75.0; // Chiều cao lắp đặt mặc định (cm)
const float MIN_DISTANCE = 20.0;        // Vùng mù (cm)
const float MAX_MEASURABLE_WATER = INSTALLATION_HEIGHT - MIN_DISTANCE; // 55.0 cm

// ==========================================
// THÔNG SỐ BỘ LỌC KALMAN 1 CHIỀU
// ==========================================
float kf_p = 1.0;
float kf_x = 0.0;
float kf_q = 0.1;
float kf_r = 5.0;
bool isFirstMeasurement = true;

float applyKalmanFilter(float measurement) {
  if (isFirstMeasurement) {
    kf_x = measurement;
    isFirstMeasurement = false;
    return kf_x;
  }
  kf_p = kf_p + kf_q;
  float kf_k = kf_p / (kf_p + kf_r);
  kf_x = kf_x + kf_k * (measurement - kf_x);
  kf_p = (1 - kf_k) * kf_p;
  return kf_x;
}

// ==========================================
// BỘ LỌC TRUNG VỊ (MEDIAN FILTER) CHỐNG NHIỄU SIÊU ÂM
// ==========================================
float getRawDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 40000);
  if (duration == 0) return -1.0;

  return (duration * 0.0343) / 2.0;
}

float getMedianDistance() {
  float readings[5];
  int validCount = 0;

  for (int i = 0; i < 5; i++) {
    float d = getRawDistance();
    if (d > 0) {
      readings[validCount] = d;
      validCount++;
    }
    delay(20);
  }

  if (validCount == 0) return -1.0;

  for (int i = 0; i < validCount - 1; i++) {
    for (int j = i + 1; j < validCount; j++) {
      if (readings[i] > readings[j]) {
        float temp = readings[i];
        readings[i] = readings[j];
        readings[j] = temp;
      }
    }
  }

  return readings[validCount / 2];
}

// ==========================================
// CẤU HÌNH LORA RA-02 (ESP32)
// ==========================================
#define SCK_PIN  18
#define MISO_PIN 19
#define MOSI_PIN 32
#define SS_PIN   15
#define RST_PIN  26
#define DIO0_PIN 4

unsigned long previousMillis = 0;
const long interval = 2000;

void setup() {
  Serial.begin(115200);
  delay(100);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("Khong tim thay man hinh OLED"));
    for(;;);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);
  display.println("Node Starting...");
  display.display();

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN);
  LoRa.setPins(SS_PIN, RST_PIN, DIO0_PIN);

  if (!LoRa.begin(433175000)) {
    Serial.println("Khoi tao LoRa THAT BAI!");
    display.println("LoRa ERR!");
    display.display();
    while (1);
  }

  LoRa.setSpreadingFactor(7);
  LoRa.setTxPower(14);

  Serial.println("Khoi tao LoRa THANH CONG!");
  display.println("LoRa OK!");
  display.display();
  delay(1000);
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    float median_distance = getMedianDistance();

    int currentDistance = 0;
    float water_level_cm = 0.0;
    int currentWaterLevelPercent = 0;
    String statusMsg = "";

    if (median_distance < 0) {
      statusMsg = "INVALID";
    } else {
      float filtered_distance_cm = applyKalmanFilter(median_distance);
      currentDistance = round(filtered_distance_cm);

      if (filtered_distance_cm <= MIN_DISTANCE) {
        water_level_cm = MAX_MEASURABLE_WATER;
        currentWaterLevelPercent = 100;
        statusMsg = "BLIND_ZONE";

      } else if (filtered_distance_cm >= INSTALLATION_HEIGHT) {
        water_level_cm = 0.0;
        currentWaterLevelPercent = 0;
        statusMsg = "DRY";

      } else {
        float rawWl = INSTALLATION_HEIGHT - filtered_distance_cm;

        if (rawWl > MAX_MEASURABLE_WATER) rawWl = MAX_MEASURABLE_WATER;
        if (rawWl < 0) rawWl = 0;

        water_level_cm = round(rawWl * 100.0) / 100.0;

        float p = (water_level_cm / MAX_MEASURABLE_WATER) * 100.0;
        currentWaterLevelPercent = round(p);
        if (currentWaterLevelPercent > 100) currentWaterLevelPercent = 100;

        statusMsg = "NORMAL";
      }
    }

    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("--- SENSOR NODE ---");
    display.print("Dist : "); display.print(currentDistance); display.println(" cm");
    display.print("Water: "); display.print(water_level_cm, 1); display.println(" cm");
    display.print("Level: "); display.print(currentWaterLevelPercent); display.println(" %");
    display.print("Zone : "); display.println(statusMsg);

    String payload = String(currentDistance) + "," +
                     String(water_level_cm, 1) + "," +
                     String(currentWaterLevelPercent) + "," +
                     statusMsg;

    display.println("-------------------");
    display.print("TX: "); display.println(payload);
    display.display();

    Serial.print("Dang gui LoRa: ");
    Serial.println(payload);

    LoRa.beginPacket();
    LoRa.print(payload);
    LoRa.endPacket();
  }
}
