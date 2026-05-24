/*
 * HCM Flood — Node LoRa trạm S01 (HC-SR04 + OLED)
 * Chỉ đo và gửi khoảng cách tới vật cản (cm).
 * Payload LoRa: S01,<distance_cm>
 * Gateway → MQTT {"sensor_id":"S01","value":<distance>}
 * BE hiển thị trực tiếp value (cm) lên FE
 */
#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define LORA_SS 5
#define LORA_RST 26
#define LORA_DIO0 4
#define LORA_SCK 18
#define LORA_MISO 19
#define LORA_MOSI 23

#define TRIG_PIN 27
#define ECHO_PIN 13

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

const char* SENSOR_ID = "S01";

unsigned long previousMillis = 0;
const long interval = 5000;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("OLED that bai!"));
    while (1) {
    }
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 10);
  display.print(SENSOR_ID);
  display.println(" khoi dong...");
  display.display();

  randomSeed(analogRead(0));

  pinMode(LORA_RST, OUTPUT);
  digitalWrite(LORA_RST, LOW);
  delay(50);
  digitalWrite(LORA_RST, HIGH);
  delay(100);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(433175000)) {
    Serial.println("LoRa that bai!");
    display.setCursor(0, 30);
    display.println("Loi: LoRa khong phan hoi");
    display.display();
    while (1) {
    }
  }

  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setSyncWord(0x34);
  LoRa.setTxPower(14);

  Serial.print(SENSOR_ID);
  Serial.println(" san sang — chi gui khoang cach (cm)");
}

int getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    return -1;
  }

  int distance = (int)(duration * 0.034 / 2);
  if (distance <= 0) {
    return -1;
  }
  return distance;
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= interval) {
    delay(random(0, 500));
    previousMillis = currentMillis;

    int distance = getDistance();

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print("TRAM: ");
    display.println(SENSOR_ID);

    if (distance < 0) {
      Serial.println("Do khong hop le — khong gui LoRa");
      display.setCursor(0, 20);
      display.println("Loi cam bien");
      display.display();
      return;
    }

    String payload = String(SENSOR_ID) + "," + String(distance);

    Serial.print("Dang gui: ");
    Serial.println(payload);

    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
    display.setCursor(0, 20);
    display.print("Khoang cach: ");
    display.print(distance);
    display.println(" cm");
    display.display();

    LoRa.beginPacket();
    LoRa.print(payload);
    LoRa.endPacket();
  }
}
