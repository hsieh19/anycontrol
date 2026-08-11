#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>

// -----------------------
// 1. 引脚定义 (针对 ESP32-C3)
// -----------------------
// RS485_B (物理从站总线，UART1)
static const int PIN_RS485_RX   = 2;
static const int PIN_RS485_TX   = 10;

// RS485_A (物理原主站总线，UART0 映射引脚)
static const int PIN_MASTER_RX  = 20;
static const int PIN_MASTER_TX  = 21;

// -----------------------
// 2. 常量定义
// -----------------------
#define FIRMWARE_VERSION "1.0.1"

static constexpr const char *WIFI_AP_SSID = "AnyControl_AP";
static constexpr const char *WIFI_AP_PASSWORD = "12345678";

static const uint32_t RS485_DEFAULT_BAUDRATE = 9600;
static const uint8_t RS485_DEFAULT_DATABITS = 8;
static const uint8_t RS485_DEFAULT_STOPBITS = 1;
static const uint8_t RS485_DEFAULT_PARITY = 0;

// -----------------------
// 3. 结构体定义
// -----------------------

// WiFi STA 配置 (支持 DHCP 与静态 IP)
struct WifiStaConfig {
  bool valid;
  String ssid;
  String password;
  bool useStaticIp;
  IPAddress ip;
  IPAddress subnet;
  IPAddress gateway;
  IPAddress dns;
};

// 双主站中继网关配置
struct DualMasterConfig {
  uint32_t masterBaud;   // RS485 串口波特率 (RS485_A 与 RS485_B 共用)
  uint8_t  masterData;   // 数据位 (7/8)
  uint8_t  masterParity; // 校验位 (0:None, 1:Even, 2:Odd)
  uint8_t  masterStop;   // 停止位 (1/2)
  uint16_t wifiPort;     // WiFi TCP Server 监听端口 (Master 2 访问端口，默认 9502)
};

// -----------------------
// 4. 全局变量声明 (Extern)
// -----------------------
extern uint8_t g_macAddress[6];
extern HardwareSerial MasterSerial;
extern HardwareSerial RS485Serial;
extern Preferences g_prefs;

extern WifiStaConfig g_wifiStaConfig;

extern WebServer g_httpServer;
extern volatile bool g_needRestart;
extern String g_gatewayName;
extern uint32_t g_heartbeatInterval;
extern uint32_t g_lastBusLatencyMs;
extern uint32_t g_master1FrameCount;
extern uint32_t g_master2FrameCount;
extern uint32_t g_busCrcErrorCount;
extern String g_otaApiBase;
extern DualMasterConfig g_dualMasterConfig;

// -----------------------
// 5. 调试输出宏
// -----------------------
#define APP_LOG(fmt, ...)                                                      \
  do {                                                                         \
    Serial.printf(fmt, ##__VA_ARGS__);                                         \
    Serial.println();                                                          \
  } while (0)

#define APP_PRINT(x)                                                           \
  do {                                                                         \
    Serial.print(x);                                                           \
  } while (0)

#define APP_PRINTLN(x)                                                         \
  do {                                                                         \
    Serial.println(x);                                                         \
  } while (0)
