/**
 * ESP32 SINGLE CHANNEL GATEWAY (433.175 MHz)
 * Dành cho mạch: ESP32 + Ra-02 (SX1278)
 * Đã cập nhật cho màn hình OLED 0.96 inch (I2C: SDA=21, SCL=22)
 * Cập nhật: Forward gói JSON tuỳ chỉnh sang MQTT (HiveMQ Cloud - TLS 8883)
 */

#include <WiFi.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

// =========================================================================
// CẤU HÌNH MÀN HÌNH OLED 0.96 INCH
// =========================================================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// =========================================================================
// 1. CẤU HÌNH WIFI & MQTT HIVEMQ CLOUD
// =========================================================================
const char* ssid          = "Cafe Me Khuc";     
const char* pass          = "888888888";        

const char* mqtt_server   = "1af3004441454f2aabda930c941a552d.s1.eu.hivemq.cloud";
const int   mqtt_port     = 8883; // Bắt buộc dùng 8883 cho HiveMQ Cloud
const char* mqtt_user     = "tram_cam_bien_1";
const char* mqtt_password = "Minh@2003";
const char* mqtt_topic    = "hcm/flood/data"; // Đã cập nhật topic theo yêu cầu

WiFiClientSecure espClient;
PubSubClient mqtt_client(espClient);

// =========================================================================
// 3. CẤU HÌNH PHẦN CỨNG LORA
// =========================================================================
#define SCK_PIN  18
#define MISO_PIN 19
#define MOSI_PIN 23
#define SS_PIN   5    
#define RST_PIN  26   
#define DIO0_PIN 4    

#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

#define FREQUENCY  433175000  
#define SPREADING  7          
#define BANDWIDTH  125E3      

// =========================================================================
// THANH GHI SX1278 (GIỮ NGUYÊN)
// =========================================================================
#define REG_FIFO                    0x00
#define REG_OP_MODE                 0x01
#define REG_FRF_MSB                 0x06
#define REG_FRF_MID                 0x07
#define REG_FRF_LSB                 0x08
#define REG_PA_CONFIG               0x09
#define REG_FIFO_ADDR_PTR           0x0D
#define REG_FIFO_TX_BASE_ADDR       0x0E
#define REG_FIFO_RX_BASE_ADDR       0x0F
#define REG_FIFO_RX_CURRENT_ADDR    0x10
#define REG_IRQ_FLAGS               0x12
#define REG_RX_NB_BYTES             0x13
#define REG_MODEM_STAT              0x18
#define REG_MODEM_CONFIG_1          0x1D
#define REG_MODEM_CONFIG_2          0x1E
#define REG_MODEM_CONFIG_3          0x26
#define REG_SYNC_WORD               0x39
#define REG_DIO_MAPPING_1           0x40
#define REG_VERSION                 0x42

#define MODE_LONG_RANGE_MODE        0x80
#define MODE_SLEEP                  0x00
#define MODE_STDBY                  0x01
#define MODE_TX                     0x03
#define MODE_RX_CONTINUOUS          0x05

char packetBuffer[256];

void writeRegister(byte addr, byte data) {
  digitalWrite(SS_PIN, LOW);
  SPI.transfer(addr | 0x80);
  SPI.transfer(data);
  digitalWrite(SS_PIN, HIGH);
}

byte readRegister(byte addr) {
  digitalWrite(SS_PIN, LOW);
  SPI.transfer(addr & 0x7F);
  byte val = SPI.transfer(0x00);
  digitalWrite(SS_PIN, HIGH);
  return val;
}

void setupLoRa() {
  digitalWrite(RST_PIN, LOW); delay(100);
  digitalWrite(RST_PIN, HIGH); delay(100);

  byte version = readRegister(REG_VERSION);
  Serial.print("LoRa Chip Version: 0x"); Serial.println(version, HEX);
  if (version != 0x12) {
    Serial.println("Error: SX1278 not found!");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("LoRa Error!");
    display.display();
    while (1);
  }

  writeRegister(REG_OP_MODE, MODE_LONG_RANGE_MODE | MODE_SLEEP);
  writeRegister(REG_OP_MODE, MODE_LONG_RANGE_MODE | MODE_STDBY);

  uint64_t frf = ((uint64_t)FREQUENCY << 19) / 32000000;
  writeRegister(REG_FRF_MSB, (uint8_t)(frf >> 16));
  writeRegister(REG_FRF_MID, (uint8_t)(frf >> 8));
  writeRegister(REG_FRF_LSB, (uint8_t)(frf >> 0));

  writeRegister(REG_SYNC_WORD, 0x34); 

  writeRegister(REG_MODEM_CONFIG_1, 0x72); 
  writeRegister(REG_MODEM_CONFIG_2, 0x74); 
  writeRegister(REG_MODEM_CONFIG_3, 0x04); 

  writeRegister(REG_FIFO_TX_BASE_ADDR, 0);
  writeRegister(REG_FIFO_RX_BASE_ADDR, 0);
  writeRegister(REG_IRQ_FLAGS, 0xFF);      

  writeRegister(REG_OP_MODE, MODE_LONG_RANGE_MODE | MODE_RX_CONTINUOUS);
  Serial.println("[+] LoRa init done. Listening on 433.175 MHz");
  
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("GW: Ready");
  display.println("Listening...");
  display.display();
}

// =========================================================================
// HÀM KẾT NỐI MQTT
// =========================================================================
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

// =========================================================================
// ĐÓNG GÓI VÀ GỬI LÊN MQTT (ĐÃ CẬP NHẬT)
// =========================================================================
void sendMqttPacket(char *data, int len, int rssi, float snr) {
  // 1. Đọc dữ liệu thô từ Node gửi sang (Dạng CSV: "30,81,OK")
  String receivedData = "";
  for(int i=0; i<len; i++) {
    receivedData += (char)data[i];
  }

  // 2. Tách biến khoảng cách và mực nước
  int fake_distance = 0;
  int water_level = 0;
  
  int firstComma = receivedData.indexOf(',');
  int secondComma = receivedData.indexOf(',', firstComma + 1);
  
  if (firstComma != -1 && secondComma != -1) {
    fake_distance = receivedData.substring(0, firstComma).toInt();
    water_level = receivedData.substring(firstComma + 1, secondComma).toInt();
  } else {
    // Fallback nếu chuỗi không có dấu phẩy
    fake_distance = receivedData.toInt();
  }

  // 3. Khai báo ID trạm và tạo chuỗi JSON Payload
  String sensor_id = "NODE_007"; // Đặt ID tĩnh hoặc lấy từ biến cấu hình
  String payload = "{\"sensor_id\": \"" + sensor_id + "\", \"value\":" + String(fake_distance) + "}";

  // 4. In log ra Serial chuẩn theo yêu cầu của bạn
  Serial.print("["); Serial.print(sensor_id); Serial.print("] raw_distance: ");
  Serial.print(fake_distance); Serial.print("cm, water_level: "); Serial.print(water_level); Serial.println("cm");

  // 5. Gửi lên MQTT Broker
  if (mqtt_client.connected()) {
    if(mqtt_client.publish(mqtt_topic, payload.c_str())) {
      display.fillRect(0, 48, 128, 16, SSD1306_BLACK);
      display.setCursor(0, 48);
      display.print("MQTT Pub: OK");
    } else {
      display.fillRect(0, 48, 128, 16, SSD1306_BLACK);
      display.setCursor(0, 48);
      display.print("MQTT Pub: FAIL");
    }
  } else {
    Serial.println("[-] Mat ket noi MQTT, drop packet");
  }
  display.display();
}

void setup() {
  Serial.begin(115200);
  delay(100);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("Khong tim thay OLED"));
    for(;;); 
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Gateway Starting...");
  display.display();

  Serial.println();
  Serial.print("Connecting to WiFi: "); Serial.println(ssid);
  
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); 
    Serial.print(".");
  }
  Serial.println(" WiFi Connected!");
  
  // Cấu hình kết nối bảo mật TLS cho HiveMQ Cloud
  espClient.setInsecure();
  mqtt_client.setServer(mqtt_server, mqtt_port);

  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  pinMode(SS_PIN, OUTPUT);
  pinMode(DIO0_PIN, INPUT);
  
  setupLoRa();
}

void loop() {
  // Duy trì kết nối MQTT
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt_client.connected()) {
      reconnectMQTT();
    }
    mqtt_client.loop();
  }

  // Kiểm tra cờ ngắt IRQ nhận LoRa
  byte irqFlags = readRegister(REG_IRQ_FLAGS);
  
  if ((irqFlags & 0x40)) { // RX_DONE
    writeRegister(REG_IRQ_FLAGS, 0x40); 
    
    int len = readRegister(REG_RX_NB_BYTES);
    byte addr = readRegister(REG_FIFO_RX_CURRENT_ADDR);
    writeRegister(REG_FIFO_ADDR_PTR, addr);
    
    for(int i=0; i<len; i++) {
      packetBuffer[i] = readRegister(REG_FIFO);
    }
    
    int rssi = readRegister(0x1A) - 164;
    byte snr_raw = readRegister(0x19);
    float snr = (int8_t)snr_raw * 0.25;

    // Cập nhật OLED hiển thị thông số sóng
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("--- RX PACKET ---");
    display.print("Size: "); display.print(len); display.println(" bytes");
    display.print("RSSI: "); display.print(rssi); display.println(" dBm");

    if (!(irqFlags & 0x20)) { // PayloadCRCError = 0
       sendMqttPacket(packetBuffer, len, rssi, snr);
    } else {
       Serial.println("CRC Error - Dropping packet");
       display.setCursor(0, 48);
       display.print("CRC Error! Dropped");
       display.display();
    }
  }
  
  yield();
}
