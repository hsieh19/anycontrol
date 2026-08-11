#pragma once

#include "Globals.h"

// -----------------------
// WiFi 网络管理器 (STA / AP 自适应 + 静态 IP 支持)
// -----------------------

static void initWifi() {
  WiFi.persistent(false);
  WiFi.disconnect(true);
  delay(100);

  if (g_wifiStaConfig.valid && g_wifiStaConfig.ssid.length() > 0) {
    WiFi.mode(WIFI_STA);

    // 若配置了静态 IP，则在连接前应用静态网络参数
    if (g_wifiStaConfig.useStaticIp) {
      WiFi.config(g_wifiStaConfig.ip, g_wifiStaConfig.gateway, g_wifiStaConfig.subnet, g_wifiStaConfig.dns);
      APP_PRINT("[WiFi] Configured Static IP: ");
      APP_PRINTLN(g_wifiStaConfig.ip);
    }

    APP_PRINT("WiFi Connecting to: ");
    APP_PRINTLN(g_wifiStaConfig.ssid);
    WiFi.begin(g_wifiStaConfig.ssid.c_str(), g_wifiStaConfig.password.c_str());

    unsigned long start = millis();
    const unsigned long timeoutMs = 12000;
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeoutMs) {
      delay(100);
    }

    if (WiFi.status() != WL_CONNECTED) {
      APP_PRINTLN("WiFi Timed out, falling back to AP mode");
      WiFi.disconnect(true);
      delay(200);
      WiFi.mode(WIFI_AP);
      delay(100);
      WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);
    }
  } else {
    WiFi.mode(WIFI_AP);
    delay(100);
    WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);
  }

  if (WiFi.getMode() == WIFI_STA && WiFi.status() == WL_CONNECTED) {
    APP_PRINT("WiFi STA connected, IP: ");
    APP_PRINTLN(WiFi.localIP());
  } else {
    APP_PRINT("WiFi AP mode started, SSID: ");
    APP_PRINTLN(WIFI_AP_SSID);
    APP_PRINT("AP IP: ");
    APP_PRINTLN(WiFi.softAPIP());
  }
}
