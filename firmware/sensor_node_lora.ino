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
// THÔNG SỐ CẢM BIẾN JSN-SR04T
// ==========================================
const int TRIG_PIN = 27;
const int ECHO_PIN = 13;
const float INSTALLATION_HEIGHT = 75.0; // cm
const float MIN_DISTANCE = 20.0;        // cm

// ==========================================
// CẤU HÌNH LORA RA-02 (ESP32)
// ==========================================
#define SCK_PIN  18
#define MISO_PIN 19
#define MOSI_PIN 32
#define SS_PIN   15
#define RST_PIN  26
#define DIO0_PIN 4

// Biến lưu thời gian để đo theo chu kỳ
unsigned long previousMillis = 0;
const long interval = 2000; // Đo và gửi LoRa mỗi 2 giây

void setup() {
  Serial.begin(115200);
  delay(100);

  // 1. Khởi tạo OLED
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

  // 2. Khởi tạo Cảm biến
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // 3. Khởi tạo LoRa
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  LoRa.setPins(SS_PIN, RST_PIN, DIO0_PIN);

  if (!LoRa.begin(433175000)) { // Tần số 433.175 MHz
    Serial.println("Khoi tao LoRa THAT BAI!");
    display.println("LoRa ERR!");
    display.display();
    while (1);
  }
  
  // Cấu hình thông số phát sóng mạnh nhất
  LoRa.setSpreadingFactor(7);
  LoRa.setTxPower(20); 
  
  Serial.println("Khoi tao LoRa THANH CONG!");
  display.println("LoRa OK!");
  display.display();
  delay(1000);
}

void loop() {
  unsigned long currentMillis = millis();
  
  // Thực hiện công việc mỗi 2 giây
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // --- BƯỚC 1: ĐO KHOẢNG CÁCH ---
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long duration = pulseIn(ECHO_PIN, HIGH, 40000);
    int currentDistance = 0;
    int currentWaterLevelPercent = 0;
    String statusMsg = "";

    if (duration == 0) {
      statusMsg = "ERR_SENSOR";
    } else {
      float distance_cm = (duration * 0.0343) / 2.0;
      currentDistance = round(distance_cm);

      if (distance_cm < MIN_DISTANCE) {
        currentWaterLevelPercent = 100;
        statusMsg = "BLIND_ZONE";
      } else if (distance_cm > INSTALLATION_HEIGHT) {
        currentWaterLevelPercent = 0;
        statusMsg = "OK";
      } else {
        float water_level_cm = INSTALLATION_HEIGHT - distance_cm;
        float max_capacity_cm = INSTALLATION_HEIGHT - MIN_DISTANCE;
        currentWaterLevelPercent = round((water_level_cm / max_capacity_cm) * 100.0);
        if (currentWaterLevelPercent > 100) currentWaterLevelPercent = 100;
        if (currentWaterLevelPercent < 0) currentWaterLevelPercent = 0;
        statusMsg = "OK";
      }
    }

    // --- BƯỚC 2: HIỂN THỊ OLED ---
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("--- SENSOR NODE ---");
    display.print("Khoang cach: "); display.print(currentDistance); display.println(" cm");
    display.print("Muc nuoc   : "); display.print(currentWaterLevelPercent); display.println(" %");
    display.print("Status     : "); display.println(statusMsg);
    
    // --- BƯỚC 3: PHÁT LORA ---
    // Định dạng chuỗi gửi đi: "Distance,Percent,Status" (vd: "30,81,OK")
    String payload = String(currentDistance) + "," + String(currentWaterLevelPercent) + "," + statusMsg;
    
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
