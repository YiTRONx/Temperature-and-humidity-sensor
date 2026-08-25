#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "time.h"
// 引入ESP32内置Flash存储库（替代EEPROM）
#include <Preferences.h>
#include<esp_system.h>

// --- AHT10 相关定义 ---
#define AHT10_ADDR 0x38
#define CMD_INIT 0xE1
#define CMD_MEASURE 0xAC

float temperature, humidity;    //存储读取结果
float temp_result, hum_result;  //结果保留一位小数
int temp_decimal=8,temp_integer=88;  //温度整数小数分离
int hum_decimal=8,hum_integer=88;    //湿度整数小数分离

// --- OLED 初始化（地址0x3C，保持原引脚配置） ---
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE, /* clock=*/ 9, /* data=*/ 8);

// --- 配置结构体（替代原EEPROM配置，包含温湿度双阈值） ---
struct DeviceConfig {
  // WiFi配置（保持原结构）
  char ssid[32];
  char password[64];
  uint8_t hasConfig;
  
  // 温湿度阈值（同时包含温度+湿度）
  int TEMP_Upper;
  int TEMP_Lower;
  int HUM_Upper;
  int HUM_Lower;
  
  // 新增配置项
  char device_nickname[32];  // 设备昵称
  char device_location[64];  // 设备位置
  char mqtt_server[64];      // MQTT服务器地址
  uint16_t mqtt_port;        // MQTT端口
  unsigned long read_interval;  // 刷新频率(ms)
  unsigned long screen_off_time;// 熄屏时间(ms，0=常亮)
};

// 全局配置实例（初始化值保持原代码默认值）
DeviceConfig deviceConfig = {
  .ssid = "",
  .password = "",
  .hasConfig = 0,
  
  .TEMP_Upper = 30,
  .TEMP_Lower = 0,
  .HUM_Upper = 80,
  .HUM_Lower = 0,
  
  .device_nickname = "温湿度传感器V2.1",
  .device_location = "",
  .mqtt_server = "iot.yitronx.cn",
  .mqtt_port = 13343,
  .read_interval = 2000,
  .screen_off_time = 0
};

// --- Flash存储实例 ---
Preferences preferences;
#define CONFIG_NAMESPACE "TH_CONFIG"  // Flash命名空间

// --- WiFi 相关定义（完全保留原代码） ---
bool shouldConnectWiFi = false;
String pendingSSID = "";
String pendingPASS = "";
unsigned long wifiTimer = 0;
bool isConnecting = false;

// --- 蓝牙 相关定义（完全保留原代码） ---
#define SERVICE_UUID        "74685301-2022-2026-0114-6D2B8A3F9E1C"
// #define SERVICE_UUID        "74685301-2022-2026-0114-6D2B8A38AD4C"
#define CHARACTERISTIC_UUID "BEB5483E-36E1-4688-B7F5-EA07361B26A8"
#define DeviceName          "ESP32-TH-V2"
bool isAdvertising = false;//蓝牙闪烁用
bool bleRunning = false; //标记蓝牙当前运行状态
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;

// --- 服务器 相关定义（完全保留原代码） ---
WiFiClient espClient;
PubSubClient client(espClient);
bool isServerConnected = false;
bool isServerConnecting = false;//闪烁用
portMUX_TYPE coreMux = portMUX_INITIALIZER_UNLOCKED;
volatile bool mqttReconnectFlag = false;
volatile bool timeSyncFlag = false;
volatile bool isTimeSynced = false;
volatile struct tm syncTimeInfo;

struct tm currentTime;
bool timeIsSynced = false;
bool mqttConnected = false;
bool bleDeviceConnected = false;

// --- 时间设置 相关定义（完全保留原代码） ---
const char* ntpServer = "ntp.aliyun.com";
const long  gmtOffset_sec = 28800;
const int   daylightOffset_sec = 0;

// --- 非阻塞定时器 相关定义 ---
unsigned long ReadTimer = 0;
unsigned long oledUpdateTimer = 0;
bool OLED_Flicker_Flag = true;
unsigned long mqttReconnectTimer = 0;
unsigned long lastMsg = 0;
const unsigned long READ_INTERVAL = 2000;
const unsigned long OLED_UPDATE_INTERVAL = 1000;
const unsigned long MQTT_RECONNECT_INTERVAL = 5000;
const unsigned long WiFi_Timeout_INTERVAL = 15000;

// --- 阈值报警功能 相关定义 ---
bool TEMP_Alarm_flag = false;
bool HUM_Alarm_flag = false;
unsigned long Alarm_Timer = 0;
int Display_Reversed = 1;
int MQTT_Alarm_temp = 0;//报警发送标志位
int MQTT_Alarm_hum = 0;//报警发送标志位

// --- 熄屏相关变量 ---
unsigned long screenOnTimer = 0;
bool screenIsOn = true;
#define TouchPin 13
int TouchState = 0;
int screenTime = 0;
int refreshTime = 0;

// ------------------------------
// Flash存储操作函数（替代原EEPROM函数）
// ------------------------------
// 保存配置到Flash
void saveConfigToFlash() {
  preferences.begin(CONFIG_NAMESPACE, false); // 可写模式
  
  // 保存WiFi配置（原EEPROM逻辑迁移）
  preferences.putBytes("wifi_ssid", deviceConfig.ssid, sizeof(deviceConfig.ssid));
  preferences.putBytes("wifi_pass", deviceConfig.password, sizeof(deviceConfig.password));
  preferences.putUChar("wifi_config", deviceConfig.hasConfig);
  
  // 保存温湿度阈值（核心：同时包含温度+湿度）
  preferences.putInt("temp_upper", deviceConfig.TEMP_Upper);
  preferences.putInt("temp_lower", deviceConfig.TEMP_Lower);
  preferences.putInt("hum_upper", deviceConfig.HUM_Upper);
  preferences.putInt("hum_lower", deviceConfig.HUM_Lower);
  
  // 保存新增配置项
  preferences.putBytes("nickname", deviceConfig.device_nickname, sizeof(deviceConfig.device_nickname));
  preferences.putBytes("location", deviceConfig.device_location, sizeof(deviceConfig.device_location));
  preferences.putBytes("mqtt_server", deviceConfig.mqtt_server, sizeof(deviceConfig.mqtt_server));
  preferences.putUShort("mqtt_port", deviceConfig.mqtt_port);
  preferences.putULong("read_interval", deviceConfig.read_interval);
  preferences.putULong("screen_off", deviceConfig.screen_off_time);
  
  preferences.end();
  Serial.println("配置已保存到Flash");
}

// 从Flash加载配置
void loadConfigFromFlash() {
  preferences.begin(CONFIG_NAMESPACE, true); // 只读模式
  
  // 加载WiFi配置（原EEPROM逻辑迁移）
  if (preferences.isKey("wifi_ssid")) {
    preferences.getBytes("wifi_ssid", deviceConfig.ssid, sizeof(deviceConfig.ssid));
    preferences.getBytes("wifi_pass", deviceConfig.password, sizeof(deviceConfig.password));
    deviceConfig.hasConfig = preferences.getUChar("wifi_config", 0);
  }
  
  // 加载温湿度阈值（核心：同时加载温度+湿度）
  deviceConfig.TEMP_Upper = preferences.getInt("temp_upper", 30);
  deviceConfig.TEMP_Lower = preferences.getInt("temp_lower", 0);
  deviceConfig.HUM_Upper = preferences.getInt("hum_upper", 80);
  deviceConfig.HUM_Lower = preferences.getInt("hum_lower", 0);
  
  // 加载新增配置项
  if (preferences.isKey("nickname")) {
    preferences.getBytes("nickname", deviceConfig.device_nickname, sizeof(deviceConfig.device_nickname));
  }
  if (preferences.isKey("location")) {
    preferences.getBytes("location", deviceConfig.device_location, sizeof(deviceConfig.device_location));
  }
  if (preferences.isKey("mqtt_server")) {
    preferences.getBytes("mqtt_server", deviceConfig.mqtt_server, sizeof(deviceConfig.mqtt_server));
  }
  deviceConfig.mqtt_port = preferences.getUShort("mqtt_port", 13343);
  deviceConfig.read_interval = preferences.getULong("read_interval", 2000);
  deviceConfig.screen_off_time = preferences.getULong("screen_off", 0);
  
  preferences.end();
  Serial.println("配置已从Flash加载");
  
  // 打印阈值（调试用，验证湿度阈值加载）
  Serial.printf("加载阈值：温度 %d~%d°C | 湿度 %d~%d%%\n", 
                deviceConfig.TEMP_Lower, deviceConfig.TEMP_Upper,
                deviceConfig.HUM_Lower, deviceConfig.HUM_Upper);
}

// 清除Flash中所有配置
void clearAllConfig() {
  preferences.begin(CONFIG_NAMESPACE, false);
  preferences.clear(); // 清空所有配置
  preferences.end();
  
  // 恢复默认配置（包含温湿度双阈值）
  memset(&deviceConfig, 0, sizeof(DeviceConfig));
  deviceConfig.TEMP_Upper = 30;
  deviceConfig.TEMP_Lower = 0;
  deviceConfig.HUM_Upper = 80;
  deviceConfig.HUM_Lower = 0;
  strcpy(deviceConfig.device_nickname, "温湿度传感器V2.1");
  strcpy(deviceConfig.device_location, "未设置");
  strcpy(deviceConfig.mqtt_server, "iot.yitronx.cn");
  deviceConfig.mqtt_port = 14167;
  deviceConfig.read_interval = 2000;
  deviceConfig.screen_off_time = 0;
  
  Serial.println("所有配置已清除，恢复默认值");
  ESP.restart();
}

// ------------------------------
// AHT10传感器（完全保留原代码）
// ------------------------------
bool initAHT10(){
  Wire.beginTransmission(AHT10_ADDR);
  Wire.write(CMD_INIT);
  Wire.write(0x08);  // 校准使能
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) {
    return false;
  }
  delay(10);
  return true;
}

bool readAHT10(float &temp, float &humi) {
  uint8_t data[6] = {0};
  
  Wire.beginTransmission(AHT10_ADDR);
  Wire.write(CMD_MEASURE);
  Wire.write(0x33);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) {
    return false;
  }
  
  delay(80);
  
  Wire.requestFrom(AHT10_ADDR, 6);
  if (Wire.available() != 6) {
    return false;
  }
  
  for (int i = 0; i < 6; i++) {
    data[i] = Wire.read();
  }
  
  if (data[0] & 0x80) {
    return false;
  }
  
  uint32_t humi_raw = ((uint32_t)data[1] << 12) | 
                      ((uint32_t)data[2] << 4) | 
                      ((uint32_t)data[3] >> 4);
  humi = (float)humi_raw * 100.0 / 1048576.0;
  
  uint32_t temp_raw = (((uint32_t)data[3] & 0x0F) << 16) | 
                      ((uint32_t)data[4] << 8) | 
                      data[5];
  temp = (float)temp_raw * 200.0 / 1048576.0 - 50.0;
  
  return true;
}

// ------------------------------
// 蓝牙设置（核心修改：补充湿度阈值指令）
// ------------------------------
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    isAdvertising = false;
    Serial.println("设备已连接");
    screenIsOn = true;
    screenOnTimer = millis();
  }
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    isAdvertising = true;
    Serial.println("设备已断开，重新启动广播");
    BLEDevice::startAdvertising();
  }
};

class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pC) {
    String rxValue = String(pC->getValue().c_str());
    rxValue.trim();
    Serial.print("收到蓝牙指令：");
    Serial.println(rxValue);
    screenIsOn = true;//收到指令唤醒屏幕
    screenOnTimer = millis();
    // 1. WiFi配置指令（完全保留原代码）
    if (rxValue.indexOf("WIFI:") == 0) {
      int commaIndex = rxValue.indexOf(',');
      if (commaIndex != -1) {
        pendingSSID = rxValue.substring(5, commaIndex);
        pendingPASS = rxValue.substring(commaIndex + 1);
        Serial.print("WiFi配置：ssid=");
        Serial.print(pendingSSID);
        Serial.print(", pass=");
        Serial.println(pendingPASS);
        
        pendingSSID.toCharArray(deviceConfig.ssid, sizeof(deviceConfig.ssid));
        pendingPASS.toCharArray(deviceConfig.password, sizeof(deviceConfig.password));
        deviceConfig.hasConfig = 0xAA;
        saveConfigToFlash();
        
        shouldConnectWiFi = true;
        pCharacteristic->setValue("WIFI_PROCESSING");
        pCharacteristic->notify();
      } else {
        pCharacteristic->setValue("WIFI_FORMAT_ERR");
        pCharacteristic->notify();
      }
    }
    // 2. 温度阈值指令
    else if (rxValue.indexOf("TEMP:") == 0) {
      int commaIndex = rxValue.indexOf(',');
      if (commaIndex != -1) {
        int upper = rxValue.substring(5, commaIndex).toInt();
        int lower = rxValue.substring(commaIndex + 1).toInt();
        deviceConfig.TEMP_Upper = upper;
        deviceConfig.TEMP_Lower = lower;
        saveConfigToFlash();
        
        Serial.printf("温度阈值已设置：%d~%d°C\n", lower, upper);
        pCharacteristic->setValue(String("TEMP_OK:") + lower + "," + upper);
        pCharacteristic->notify();
      } else {
        pCharacteristic->setValue("TEMP_FORMAT_ERR");
        pCharacteristic->notify();
      }
    }
    // 3. 湿度阈值指令
    else if (rxValue.indexOf("HUM:") == 0) {
      int commaIndex = rxValue.indexOf(',');
      if (commaIndex != -1) {
        int upper = rxValue.substring(4, commaIndex).toInt();
        int lower = rxValue.substring(commaIndex + 1).toInt();
        deviceConfig.HUM_Upper = upper;
        deviceConfig.HUM_Lower = lower;
        saveConfigToFlash();
        
        Serial.printf("湿度阈值已设置：%d~%d%%\n", lower, upper);
        pCharacteristic->setValue(String("HUM_OK:") + lower + "," + upper);
        pCharacteristic->notify();
      } else {
        pCharacteristic->setValue("HUM_FORMAT_ERR");
        pCharacteristic->notify();
      }
    }
    // 4. 设备昵称指令
    else if (rxValue.indexOf("NICK:") == 0) {
      const char* nickPrefix = "NICK:";
      int prefixLen = strlen(nickPrefix);
      // 2. 获取 UTF-8 编码的中文昵称字节流（rxValue 是接收到的 UTF-8 字节数组）
      const uint8_t* nickBytes = (uint8_t*)(rxValue.c_str() + prefixLen);
      int nickByteLen = rxValue.length() - prefixLen;

      // 3. 校验昵称长度（不超过存储数组-1，留结尾\0）
      if (nickByteLen > 0 && nickByteLen < 31) {
        // 4. 拷贝 UTF-8 字节到设备配置（直接存 UTF-8，不转码）
        memset(deviceConfig.device_nickname, 0, 32); // 清空原有数据
        memcpy(deviceConfig.device_nickname, nickBytes, nickByteLen);
        deviceConfig.device_nickname[nickByteLen] = '\0'; // 加字符串结束符
      // String nickname = rxValue.substring(5);
      // if (nickname.length() > 0) {
      //   nickname.toCharArray(deviceConfig.device_nickname, sizeof(deviceConfig.device_nickname));
        saveConfigToFlash();
        
        Serial.printf("设备昵称已设置：%s\n", deviceConfig.device_nickname);
        pCharacteristic->setValue("NICK_OK");
        pCharacteristic->notify();
      } else {
        pCharacteristic->setValue("NICK_FAIL");
        pCharacteristic->notify();
      }
    }
    // 5. 设备位置指令
    else if (rxValue.indexOf("LOC:") == 0) {
      const char* locPrefix = "LOC:";
      int prefixLen = strlen(locPrefix);
      // 2. 获取 UTF-8 编码的中文昵称字节流（rxValue 是接收到的 UTF-8 字节数组）
      const uint8_t* locBytes = (uint8_t*)(rxValue.c_str() + prefixLen);
      int locByteLen = rxValue.length() - prefixLen;

      // 3. 校验昵称长度（不超过存储数组-1，留结尾\0）
      if (locByteLen > 0 && locByteLen < 31) {
        // 4. 拷贝 UTF-8 字节到设备配置（直接存 UTF-8，不转码）
        memset(deviceConfig.device_location, 0, 32); // 清空原有数据
        memcpy(deviceConfig.device_location, locBytes, locByteLen);
        deviceConfig.device_location[locByteLen] = '\0'; // 加字符串结束符
      // String location = rxValue.substring(4);
      // if (location.length() > 0) {
      //   location.toCharArray(deviceConfig.device_location, sizeof(deviceConfig.device_location));
        saveConfigToFlash();
        
        Serial.printf("设备位置已设置：%s\n", deviceConfig.device_location);
        pCharacteristic->setValue("LOC_OK");
        pCharacteristic->notify();
      } else {
        pCharacteristic->setValue("LOC_FAIL");
        pCharacteristic->notify();
      }
    }
    // 6. MQTT配置指令
    else if (rxValue.indexOf("MQTT:") == 0) {
      int commaIndex = rxValue.indexOf(',');
      if (commaIndex != -1) {
        String server = rxValue.substring(5, commaIndex);
        uint16_t port = rxValue.substring(commaIndex + 1).toInt();
        
        server.toCharArray(deviceConfig.mqtt_server, sizeof(deviceConfig.mqtt_server));
        deviceConfig.mqtt_port = port;
        saveConfigToFlash();
        
        client.setServer(deviceConfig.mqtt_server, deviceConfig.mqtt_port);
        Serial.printf("MQTT已设置：%s:%d\n", deviceConfig.mqtt_server, deviceConfig.mqtt_port);
        
        pCharacteristic->setValue("MQTT_OK");
        pCharacteristic->notify();
      } else {
        pCharacteristic->setValue("MQTT_FAIL");
        pCharacteristic->notify();
      }
    }
    // 7. 刷新频率指令
    else if (rxValue.indexOf("REFRESH:") == 0) {
      unsigned long interval = rxValue.substring(8).toInt();
      if (interval >= 500 && interval <= 30000) {
        deviceConfig.read_interval = interval;
        saveConfigToFlash();
        
        Serial.printf("刷新频率已设置：%dms\n", interval);
        pCharacteristic->setValue("REFRESH_OK");
        pCharacteristic->notify();
      } else {
        pCharacteristic->setValue("REFRESH_FAIL");
        pCharacteristic->notify();
      }
    }
    // 8. 熄屏时间指令
    else if (rxValue.indexOf("SCREEN:") == 0) {
      unsigned long offTime = rxValue.substring(7).toInt();
      deviceConfig.screen_off_time = offTime;
      saveConfigToFlash();
      
      Serial.printf("熄屏时间已设置：%dms（0=常亮）\n", offTime);
      pCharacteristic->setValue("SCREEN_OK");
      pCharacteristic->notify();
    }
    // 9. 清除配置指令
    else if (rxValue == "CLEAR") {
      clearAllConfig();
      pCharacteristic->setValue("CLEAR_OK");
      pCharacteristic->notify();
      Serial.println("所有配置已清除");
    }
    // 10. 获取配置指令
    else if (rxValue == "GET_CONFIG") {
      String configStr = String("TEMP:") + deviceConfig.TEMP_Lower + "," + deviceConfig.TEMP_Upper + "|";
      configStr += "HUM:" + String(deviceConfig.HUM_Lower) + "," + deviceConfig.HUM_Upper + "|";
      configStr += "NICK:" + String(deviceConfig.device_nickname) + "|";
      configStr += "LOC:" + String(deviceConfig.device_location) + "|";
      configStr += "MQTT:" + String(deviceConfig.mqtt_server) + "," + deviceConfig.mqtt_port + "|";
      configStr += "REFRESH:" + String(deviceConfig.read_interval) + "|";
      configStr += "SCREEN:" + String(deviceConfig.screen_off_time);
      
      pCharacteristic->setValue(configStr);
      pCharacteristic->notify();
      Serial.println("已发送当前配置");
    }
    // 未知指令
    else {
      pCharacteristic->setValue("UNKNOWN_CMD");
      pCharacteristic->notify();
    }
  }
};

// 蓝牙启动/关闭函数（完全保留原代码）
void startBLE() {
  if (bleRunning) return;
  BLEDevice::init(DeviceName);
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEDevice::setMTU(512);
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ |
                      BLECharacteristic::PROPERTY_NOTIFY|
                      BLECharacteristic::PROPERTY_WRITE |
                      BLECharacteristic::PROPERTY_INDICATE
                    );
  pCharacteristic->addDescriptor(new BLE2902());
  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();
  
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  
  isAdvertising = true;
  bleRunning = true;
  Serial.println("蓝牙已开启");
}

void stopBLE() {
  if (!bleRunning) return;
  BLEDevice::deinit(true);
  pCharacteristic = NULL;
  bleRunning = false;
  deviceConnected = false;
  isAdvertising = false;
  Serial.println("蓝牙已关闭");
}

// ------------------------------
// OLED显示函数（仅修改阈值读取源，其他完全保留）
// ------------------------------
// void page_style_1(void) {
//   if (!screenIsOn) return;
  
//   u8g2.setFontDirection(0);
//   u8g2.clearBuffer();
  
//   u8g2.setDrawColor(!Display_Reversed);
//   u8g2.drawBox(0,16,128,53);
//   u8g2.setDrawColor(Display_Reversed);
//   u8g2.drawBox(0,0,128,15);

//   u8g2.setFont(u8g2_font_wqy14_t_gb2312); 
//   u8g2.setCursor(5, 30);
//   u8g2.print("温度:");
//   u8g2.setCursor(45, 43);
//   u8g2.print("°C");
//   u8g2.setCursor(45, 58);
//   u8g2.print(".");
//   u8g2.setCursor(70, 30);
//   u8g2.print("湿度:");
//   u8g2.setCursor(113, 43);
//   u8g2.print("%");
//   u8g2.setCursor(110, 58);
//   u8g2.print(".");

//   u8g2.setFont(u8g2_font_freedoomr25_mn); 
//   u8g2.setCursor(5, 60);
//   u8g2.print(temp_integer);
//   u8g2.setCursor(70, 60);
//   u8g2.print(hum_integer);

//   u8g2.setFont(u8g2_font_freedoomr10_mu); 
//   u8g2.setCursor(50, 60);
//   u8g2.print(temp_decimal);
//   u8g2.setCursor(115, 60);
//   u8g2.print(hum_decimal);

//   if(!OLED_Flicker_Flag){
//     OLED_Flicker_Flag = true;
//     u8g2.setDrawColor(!Display_Reversed);

//     u8g2.setFont(u8g2_font_open_iconic_all_1x_t); 
//     if (WiFi.status() == WL_CONNECTED || millis() < 1000) {
//       u8g2.drawGlyph(118, 12, 0x00F7);
//     }
//     if(deviceConnected || millis() < 1000){
//       u8g2.drawGlyph(108, 12, 0x005E);
//     }
//     if(isServerConnected || millis() < 1000){
//       u8g2.drawGlyph(98, 12, 0x00C6);
//     }

//   }else if(OLED_Flicker_Flag){
//     OLED_Flicker_Flag = false;

//     u8g2.setDrawColor(!Display_Reversed);
//     if(timeIsSynced){
//       u8g2.setCursor(18, 15);
//       u8g2.print(":");
//     }else{
//       u8g2.drawDisc(7,7,5);
//     }
//     u8g2.setFont(u8g2_font_open_iconic_all_1x_t); 
//     if (isConnecting || WiFi.status() == WL_CONNECTED || millis() < 1000) {
//       u8g2.drawGlyph(118, 12, 0x00F7);
//     }
//     if(isAdvertising || deviceConnected || millis() < 1000){
//       u8g2.drawGlyph(108, 12, 0x005E);
//     }
//     if(isServerConnected || isServerConnecting || millis() < 1000){
//       u8g2.drawGlyph(98, 12, 0x00C6);
//     }
//   }
  
//   u8g2.sendBuffer();
// }

void page_style_2(){
  if (!screenIsOn) return;
  
  u8g2.setFontDirection(0);
  u8g2.clearBuffer();
  
  u8g2.setDrawColor(0);
  u8g2.drawBox(0,16,128,53);
  u8g2.setDrawColor(Display_Reversed);
  u8g2.drawBox(0,0,128,15);

  u8g2.setDrawColor(1);
  u8g2.setFont(u8g2_font_wqy14_t_gb2312); 
  u8g2.setCursor(45, 28);
  u8g2.print("°C");
  u8g2.setCursor(45, 43);
  u8g2.print(".");
  u8g2.setCursor(113, 28);
  u8g2.print("%");
  u8g2.setCursor(110, 43);
  u8g2.print(".");

  u8g2.setFont(u8g2_font_freedoomr25_mn); 
  u8g2.setCursor(5, 45);
  u8g2.print(temp_integer);
  u8g2.setCursor(70, 45);
  u8g2.print(hum_integer);

  u8g2.setFont(u8g2_font_freedoomr10_mu); 
  u8g2.setCursor(50, 45);
  u8g2.print(temp_decimal);
  u8g2.setCursor(115, 45);
  u8g2.print(hum_decimal);
  
  // 核心修改：阈值从配置结构体读取（原代码是常量，现在改为变量）
  u8g2.setCursor(15, 62);
  u8g2.print(deviceConfig.TEMP_Upper);
  u8g2.setCursor(43, 62);
  u8g2.print(deviceConfig.TEMP_Lower);
  u8g2.setCursor(80, 62);
  u8g2.print(deviceConfig.HUM_Upper);
  u8g2.setCursor(108, 62);
  u8g2.print(deviceConfig.HUM_Lower);

  
  u8g2.setDrawColor(!Display_Reversed);//显示上图标
  u8g2.setFont(u8g2_font_open_iconic_all_1x_t);
  u8g2.drawGlyph(73, 12, 0x00F3);
  u8g2.drawGlyph(43, 12, 0x0103);
  u8g2.setFont(u8g2_font_freedoomr10_mu); 
  u8g2.setCursor(83, 15);
  refreshTime = deviceConfig.read_interval/1000;
  u8g2.print(refreshTime);
  u8g2.setCursor(53, 15);
  screenTime = deviceConfig.screen_off_time/1000;
  u8g2.print(screenTime);


  if(timeIsSynced){
    char timeStr[20];
    strftime(timeStr, sizeof(timeStr), "%H %M", &currentTime);
    u8g2.setCursor(2, 15);
    u8g2.print(timeStr);
  }

  if(!OLED_Flicker_Flag){
    OLED_Flicker_Flag = true;
    u8g2.setDrawColor(!Display_Reversed);

    u8g2.setFont(u8g2_font_open_iconic_all_1x_t); 
    if (WiFi.status() == WL_CONNECTED || millis() < 1000) {
      u8g2.drawGlyph(118, 12, 0x00F7);
    }
    if(deviceConnected || millis() < 1000){
      u8g2.drawGlyph(108, 12, 0x005E);
    }
    if(isServerConnected || millis() < 1000){
      u8g2.drawGlyph(98, 12, 0x00C6);
    }

  }else if(OLED_Flicker_Flag){
    OLED_Flicker_Flag = false;

    u8g2.setDrawColor(!Display_Reversed);
    if(timeIsSynced){
      u8g2.setCursor(18, 15);
      u8g2.print(":");
    }else{
      u8g2.drawDisc(7,7,5);
    }
    u8g2.setFont(u8g2_font_open_iconic_all_1x_t); 
    if (isConnecting || WiFi.status() == WL_CONNECTED || millis() < 1000) {
      u8g2.drawGlyph(118, 12, 0x00F7);
    }
    if(isAdvertising || deviceConnected || millis() < 1000){
      u8g2.drawGlyph(108, 12, 0x005E);
    }
    if(isServerConnected || isServerConnecting || millis() < 1000){
      u8g2.drawGlyph(98, 12, 0x00C6);
    }
  }
  
  u8g2.setDrawColor(1);
  u8g2.setFont(u8g2_font_open_iconic_all_1x_t); 
  u8g2.drawGlyph(5, 56, 0x00dd);
  u8g2.drawGlyph(5, 61, 0x0070);
  u8g2.drawGlyph(33, 62, 0x00dd);
  u8g2.drawGlyph(33, 57, 0x006D);
  u8g2.drawGlyph(70, 56, 0x00dd);
  u8g2.drawGlyph(70, 61, 0x0070);
  u8g2.drawGlyph(98, 62, 0x00dd);
  u8g2.drawGlyph(98, 57, 0x006D);

  u8g2.sendBuffer();
}

// ------------------------------
// MQTT连接
// ------------------------------
void reconnectMQTT() {
  Serial.println("尝试连接 MQTT...");
  isServerConnecting = true;

  String clientId = "ESP32_TH_";
  clientId += WiFi.macAddress(); 
  clientId.trim();

  if (client.connect(clientId.c_str())) {
    Serial.println("已连接到 MQTT 服务器");
    isServerConnected = true;
    isServerConnecting = false;
    
    String OnlineLoad = "{";
      OnlineLoad += "\"DeviceName\":\"" + String(DeviceName) + "\",";
      OnlineLoad += "\"Nickname\":\"" + String(deviceConfig.device_nickname) + "\",";
      OnlineLoad += "\"Location\":\"" + String(deviceConfig.device_location) + "\",";
      OnlineLoad += "\"UUID\":\"" + String(SERVICE_UUID) + "\"";
      OnlineLoad += "}";
    client.publish("device/online", OnlineLoad.c_str());
  } else {
    Serial.print("失败, rc=");
    Serial.print(client.state());
    Serial.println(" 5秒后重试");
    mqttReconnectTimer = millis();
    isServerConnected = false;
    isServerConnecting = false;
  }
}

// ------------------------------
// 网络任务
// ------------------------------
void networkTask(void *param) {
  while(1) {
    bool needSync = false;
    portENTER_CRITICAL(&coreMux);
    needSync = timeSyncFlag;
    if(needSync) timeSyncFlag = false;
    portEXIT_CRITICAL(&coreMux);

    if(needSync && WiFi.status() == WL_CONNECTED) {
      configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
      struct tm timeinfo;
      int retry = 0;
      while(!getLocalTime(&timeinfo) && retry < 10) {
        delay(500);
        retry++;
      }
      portENTER_CRITICAL(&coreMux);
      isTimeSynced = (retry < 10);
      if(isTimeSynced){
        memcpy((void*)&syncTimeInfo, (void*)&timeinfo, sizeof(struct tm));
        Serial.println("\n时间同步成功!");
        Serial.println(&timeinfo, "当前时间: %Y-%m-%d %H:%M:%S");
      }
      portEXIT_CRITICAL(&coreMux);
    }

    if (isTimeSynced){
      struct tm timeinfo;
      getLocalTime(&timeinfo);
      memcpy((void*)&syncTimeInfo, (void*)&timeinfo, sizeof(struct tm));
    }

    bool needReconnect = false;
    portENTER_CRITICAL(&coreMux);
    needReconnect = mqttReconnectFlag;
    if(needReconnect) mqttReconnectFlag = false;
    portEXIT_CRITICAL(&coreMux);

    if(needReconnect && WiFi.status() == WL_CONNECTED) {
      reconnectMQTT();
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ------------------------------
// 初始化函数（修改：加载Flash配置，其他保留）
// ------------------------------
void setup() {
  Serial.begin(115200);
  Wire.begin(9,8);
  
  // 核心修改：加载Flash配置（替代原EEPROM读取）
  loadConfigFromFlash();
  
  // 修改：MQTT服务器从配置读取
  // client.setServer(deviceConfig.mqtt_server, deviceConfig.mqtt_port);
  client.setServer(deviceConfig.mqtt_server, 13662);
  
  startBLE();
  delay(100);

  if (!initAHT10()) {
    Serial.println("AHT10初始化失败!");
  } else {
    Serial.println("AHT10初始化成功!");
  }

  u8g2.begin();
  u8g2.enableUTF8Print();
  u8g2.setContrast(1);
  u8g2.clearBuffer();
  u8g2.sendBuffer();
  page_style_2();
  screenOnTimer = millis();
  pinMode(TouchPin,INPUT_PULLUP);
  // pinMode(TouchPin, INPUT);

  // 修改：WiFi配置从Flash读取
  if (deviceConfig.hasConfig == 0xAA) {
    WiFi.begin(deviceConfig.ssid, deviceConfig.password);
    pendingSSID = deviceConfig.ssid;
    pendingPASS = deviceConfig.password;
    Serial.print("正在读取历史WiFi并连接: ");
    Serial.println(deviceConfig.ssid);
    isConnecting = true;
    wifiTimer = millis();
  }

  xTaskCreatePinnedToCore(networkTask, "NET", 8192, NULL, 1, NULL, 0);

  delay(100);
  Serial.println("系统初始化完成！");
}

// ------------------------------
// 主循环（修改：阈值读取源，其他保留）
// ------------------------------
void loop() {
  portENTER_CRITICAL(&coreMux);
  memcpy((void*)&currentTime, (void*)&syncTimeInfo, sizeof(struct tm));
  timeIsSynced = isTimeSynced;
  mqttConnected = isServerConnected;
  portEXIT_CRITICAL(&coreMux);

  // 熄屏逻辑
  TouchState = digitalRead(TouchPin);
  if (deviceConfig.screen_off_time > 0) {
    if (millis() - screenOnTimer > deviceConfig.screen_off_time && screenIsOn) {
      screenIsOn = false;
      u8g2.clearBuffer();
      u8g2.sendBuffer();
      Serial.println("屏幕已休眠");
    }else if(TouchState == LOW)  {
      delay(200);
      TouchState = digitalRead(TouchPin);
      if(TouchState == HIGH){
        screenIsOn = true;
        screenOnTimer = millis();
        Serial.println("屏幕已唤醒");
      }
    }
  }else{
    screenIsOn = true;
  }

  // 修改：刷新频率从配置读取
  if (millis() - ReadTimer > deviceConfig.read_interval) {
    ReadTimer = millis();
    
    if (readAHT10(temperature, humidity)) {
      temp_result = round(temperature*10)/10.0-10;
      hum_result = round(humidity*10)/10.0;
      
      int temp = round(temp_result*10);
      temp_decimal = temp %10;
      temp_integer = temp /10;

      int hum = round(hum_result*10);
      hum_decimal = hum %10;
      hum_integer = hum /10;
      
      Serial.print("【");
      Serial.print(deviceConfig.device_nickname);
      Serial.print(" - ");
      Serial.print(deviceConfig.device_location);
      Serial.print("】");
      
      Serial.print("时间: ");
      if(timeIsSynced){
        char timeStr[20];
        strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &currentTime);
        Serial.print(timeStr);
      }else{
        Serial.print(millis());
      }
      Serial.print("\t温度: ");
      Serial.print(temp_result);
      Serial.print("°C\t湿度: ");
      Serial.print(hum_result);
      Serial.println("%");

      if (deviceConnected && bleRunning) {
        String dataStr = String(temp_result) + "," + String(humidity, 1);
        pCharacteristic->setValue(dataStr.c_str());
        pCharacteristic->notify();
      }

      if (client.connected() && timeIsSynced) {
        if (millis() - lastMsg > deviceConfig.read_interval) { 
          lastMsg = millis();
          char timeStr[20];
          strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &currentTime);
          
          String payload = "{";
            payload += "\"time\":\"" + String(timeStr) + "\",";
            payload += "\"UUID\":\"" + String(SERVICE_UUID) + "\",";
            payload += "\"Nickname\":\"" + String(deviceConfig.device_nickname) + "\",";
            payload += "\"Location\":\"" + String(deviceConfig.device_location) + "\",";
            payload += "\"temp\":" + String(temp_result) + ",";
            payload += "\"humi\":" + String(humidity, 1);
            payload += "}";
          client.publish("home/sensor/th", payload.c_str());
          Serial.print("MQTT 数据已发送: ");
          Serial.println(payload);
        }
      }
    }
  }

  if (millis() - oledUpdateTimer > OLED_UPDATE_INTERVAL) {
    oledUpdateTimer = millis();
    page_style_2();
  }

  // WiFi连接逻辑（保留原代码，仅修改配置读取源）
  if (shouldConnectWiFi) {
    shouldConnectWiFi = false;
    isConnecting = true;
    wifiTimer = millis();
    
    Serial.println("开始连接 WiFi...");
    WiFi.begin(pendingSSID.c_str(), pendingPASS.c_str());
  }

  if (isConnecting) {
    if (WiFi.status() == WL_CONNECTED) {
      isConnecting = false;
      Serial.println("WiFi 连接成功!");
      
      pendingSSID.toCharArray(deviceConfig.ssid, sizeof(deviceConfig.ssid));
      pendingPASS.toCharArray(deviceConfig.password, sizeof(deviceConfig.password));
      deviceConfig.hasConfig = 0xAA;
      saveConfigToFlash();

      if(bleRunning && deviceConnected){
        pCharacteristic->setValue("WIFI_OK");
        pCharacteristic->notify();
      }

      portENTER_CRITICAL(&coreMux);
      timeSyncFlag = true;
      portEXIT_CRITICAL(&coreMux);
    } 
    else if (millis() - wifiTimer > WiFi_Timeout_INTERVAL) {
      Serial.println("WiFi 连接超时失败");
      startBLE();
      isConnecting = false;
      WiFi.disconnect();
      
      if(bleRunning && deviceConnected){
        pCharacteristic->setValue("WIFI_FAIL");
        pCharacteristic->notify();
      }
    }
  } else if(WiFi.status() != WL_CONNECTED){
    if (!bleRunning) {
      startBLE();
    }
  } else if (WiFi.status() == WL_CONNECTED && isServerConnected) {
    // if (bleRunning && !deviceConnected) {
    //   stopBLE();
    // }
  }

  // MQTT状态检查（保留原代码）
  if (WiFi.status() == WL_CONNECTED) {
    client.loop();
    
    if (!client.connected()) {
      if(millis() - mqttReconnectTimer > MQTT_RECONNECT_INTERVAL){
        mqttReconnectTimer = millis();
        portENTER_CRITICAL(&coreMux);
        mqttReconnectFlag = true;
        portEXIT_CRITICAL(&coreMux);
      }
      if (!bleRunning) {
        startBLE();
      }
    }
    if(client.connected()){
      isServerConnected = true;
      // if (bleRunning && !deviceConnected) {
      //   stopBLE();
      // }
    }
  } else {
    isServerConnected = false;
  }

  // 阈值从配置结构体读取
  if(temp_integer > deviceConfig.TEMP_Upper){
    TEMP_Alarm_flag = true;
    if(millis() - Alarm_Timer > 2000){
      Alarm_Timer = millis();
      Display_Reversed = !Display_Reversed;
      Serial.printf("温度高于阈值（%d°C）！\n", deviceConfig.TEMP_Upper);
    }
    if(MQTT_Alarm_temp == 0 && client.connected()){
      char timeStr[20];
      strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &currentTime);
      
      String payload = "{";
        payload += "\"time\":\"" + String(timeStr) + "\",";
        payload += "\"UUID\":\"" + String(SERVICE_UUID) + "\",";
        payload += "\"Nickname\":\"" + String(deviceConfig.device_nickname) + "\",";
        payload += "\"Type\":\"" + String("温度过高") + "\",";
        payload += "\"temp\":" + String(temperature, 1) + ",";
        payload += "\"humi\":" + String(humidity, 1);
        payload += "}";
      client.publish("home/alarm/th", payload.c_str());
      Serial.print("MQTT 报警已发送: ");
      Serial.println(payload);
      MQTT_Alarm_temp = 1;
    }
  }else if(temp_integer < deviceConfig.TEMP_Lower){
    TEMP_Alarm_flag = true;
    if(millis() - Alarm_Timer > 2000){
      Alarm_Timer = millis();
      Display_Reversed = !Display_Reversed;
      Serial.printf("温度低于阈值（%d°C）！\n", deviceConfig.TEMP_Lower);
    }
    if(MQTT_Alarm_temp == 0 && client.connected()){
      char timeStr[20];
      strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &currentTime);
      
      String payload = "{";
        payload += "\"time\":\"" + String(timeStr) + "\",";
        payload += "\"UUID\":\"" + String(SERVICE_UUID) + "\",";
        payload += "\"Nickname\":\"" + String(deviceConfig.device_nickname) + "\",";
        payload += "\"Type\":\"" + String("温度过低") + "\",";
        payload += "\"temp\":" + String(temperature, 1) + ",";
        payload += "\"humi\":" + String(humidity, 1);
        payload += "}";
      client.publish("home/alarm/th", payload.c_str());
      Serial.print("MQTT 报警已发送: ");
      Serial.println(payload);
      MQTT_Alarm_temp = 1;
    }
  }else{
    TEMP_Alarm_flag = false;
    MQTT_Alarm_temp = 0;
  }
  
  if(hum_integer > deviceConfig.HUM_Upper){
    HUM_Alarm_flag = true;
    if(millis() - Alarm_Timer > 1000){
      Alarm_Timer = millis();
      Display_Reversed = !Display_Reversed;
      Serial.printf("湿度高于阈值（%d%%）！\n", deviceConfig.HUM_Upper);
    }
    if(MQTT_Alarm_hum == 0 && client.connected()){
      char timeStr[20];
      strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &currentTime);
      
      String payload = "{";
        payload += "\"time\":\"" + String(timeStr) + "\",";
        payload += "\"UUID\":\"" + String(SERVICE_UUID) + "\",";
        payload += "\"Nickname\":\"" + String(deviceConfig.device_nickname) + "\",";
        payload += "\"Type\":\"" + String("湿度过高") + "\",";
        payload += "\"temp\":" + String(temperature, 1) + ",";
        payload += "\"humi\":" + String(humidity, 1);
        payload += "}";
      client.publish("home/alarm/th", payload.c_str());
      Serial.print("MQTT 报警已发送: ");
      Serial.println(payload);
      MQTT_Alarm_hum = 1;
    }
  }else if(hum_integer < deviceConfig.HUM_Lower){
    HUM_Alarm_flag = true;
    if(millis() - Alarm_Timer > 1000){
      Alarm_Timer = millis();
      Display_Reversed = !Display_Reversed;
      Serial.printf("湿度低于阈值（%d%%）！\n", deviceConfig.HUM_Lower);
    }
    if(MQTT_Alarm_hum == 0 && client.connected()){
      char timeStr[20];
      strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &currentTime);
      
      String payload = "{";
        payload += "\"time\":\"" + String(timeStr) + "\",";
        payload += "\"UUID\":\"" + String(SERVICE_UUID) + "\",";
        payload += "\"Nickname\":\"" + String(deviceConfig.device_nickname) + "\",";
        payload += "\"Type\":\"" + String("湿度过低") + "\",";
        payload += "\"temp\":" + String(temperature, 1) + ",";
        payload += "\"humi\":" + String(humidity, 1);
        payload += "}";
      client.publish("home/alarm/th", payload.c_str());
      Serial.print("MQTT 报警已发送: ");
      Serial.println(payload);
      MQTT_Alarm_hum = 1;
    }
  }else{
    HUM_Alarm_flag = false;
    MQTT_Alarm_hum = 0;
  }
  
  if(!TEMP_Alarm_flag && !HUM_Alarm_flag){
    Display_Reversed = 1;
  }
}