#pragma once

#include "Globals.h"

// -----------------------
// 1. 全局变量定义 (单例实例)
// -----------------------
uint8_t g_macAddress[6];
HardwareSerial MasterSerial(0);
HardwareSerial RS485Serial(1);
Preferences g_prefs;

WifiStaConfig g_wifiStaConfig = {};
String g_gatewayName = "AnyControl 网关";
uint32_t g_heartbeatInterval = 30;
uint32_t g_lastBusLatencyMs = 0;
uint32_t g_master1FrameCount = 0;
uint32_t g_master2FrameCount = 0;
uint32_t g_busCrcErrorCount = 0;
String g_otaApiBase = "https://your-firmware-worker.workers.dev";
DualMasterConfig g_dualMasterConfig = {9600, 8, 0, 1, 9502, 1000};

WebServer g_httpServer(80);
volatile bool g_needRestart = false;

// -----------------------
// 2. 包含各模块实现
// -----------------------
#include "NetworkManager.h"
#include "DualMasterHandler.h"
#include "OtaHandler.h"
#include "WebHandler.h"

// -----------------------
// 3. 顶层业务生命周期
// -----------------------

static void loadPersistentConfig() {
    g_prefs.begin("anycontrol", true);
    g_gatewayName = g_prefs.getString("gwName", "AnyControl 网关");
    g_heartbeatInterval = g_prefs.getUInt("hbInt", 30);
    g_otaApiBase = g_prefs.getString("otaApi", "https://your-firmware-worker.workers.dev");
    
    // WiFi
    if (g_prefs.isKey("wifiSsid")) {
        g_wifiStaConfig.ssid = g_prefs.getString("wifiSsid", "");
        g_wifiStaConfig.password = g_prefs.getString("wifiPwd", "");
        g_wifiStaConfig.useStaticIp = g_prefs.getBool("wifiStatic", false);
        if (g_wifiStaConfig.useStaticIp) {
            g_wifiStaConfig.ip = IPAddress(g_prefs.getUInt("wifiIp", 0));
            g_wifiStaConfig.subnet = IPAddress(g_prefs.getUInt("wifiMask", 0));
            g_wifiStaConfig.gateway = IPAddress(g_prefs.getUInt("wifiGw", 0));
            g_wifiStaConfig.dns = IPAddress(g_prefs.getUInt("wifiDns", 0));
        }
        g_wifiStaConfig.valid = true;
    }

    // 双主站中继参数
    g_dualMasterConfig.masterBaud   = g_prefs.getUInt("dmBaud", 9600);
    g_dualMasterConfig.masterData   = g_prefs.getUChar("dmData", 8);
    g_dualMasterConfig.masterParity = g_prefs.getUChar("dmParity", 0);
    g_dualMasterConfig.masterStop   = g_prefs.getUChar("dmStop", 1);
    g_dualMasterConfig.wifiPort     = g_prefs.getUShort("dmWPort", 9502);
    g_dualMasterConfig.masterTimeout = g_prefs.getUShort("dmTimeout", 1000);

    g_prefs.end();
}

void anycontrolHardwareInit() {
    Serial.begin(115200);
    delay(500);

    loadPersistentConfig();

    APP_PRINTLN("\n=== AnyControl Gateway v" FIRMWARE_VERSION " Starting ===");
    APP_PRINTLN("Mode: AnyControl Gateway + OTA System");

    initWifi();
    initHttpServer();
    initDualMasterMode();

    APP_PRINTLN("=== Initialization Complete ===");
}

void anycontrolGatewayLoop() {
    // 1. 双主站中继核心调度
    dualMasterLoop();

    // 2. OTA 自动检测调度
    otaAutoCheckLoop();

    // 3. Web 服务器响应
    g_httpServer.handleClient();

    // 4. 系统软重启处理
    if (g_needRestart) {
        delay(1000);
        ESP.restart();
    }
}
