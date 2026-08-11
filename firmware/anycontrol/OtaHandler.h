#pragma once

#include "Globals.h"
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <esp_ota_ops.h>

/**
 * @brief 获取备用分区信息（用于回滚）
 * @param label  输出: 备用分区的固件版本号
 * @param canRollback 输出: 是否可回滚
 */
inline void getBackupPartitionInfo(String &label, bool &canRollback) {
    const esp_partition_t* running = esp_ota_get_running_partition();
    const esp_partition_t* next = esp_ota_get_next_update_partition(NULL);
    canRollback = false;
    label = "";

    if (running && next && running != next) {
        esp_app_desc_t desc;
        if (esp_ota_get_partition_description(next, &desc) == ESP_OK) {
            Preferences p;
            p.begin("anycontrol", true);
            label = p.getString("prevFwVer", "");
            p.end();
            canRollback = (label.length() > 0);
        }
    }
}

/**
 * @brief 执行固件回滚 - 切换启动分区到上一个版本
 * @return true=成功(即将重启), false=失败
 */
inline bool executeRollback() {
    const esp_partition_t* next = esp_ota_get_next_update_partition(NULL);
    if (!next) {
        APP_PRINTLN("[OTA] Rollback failed: no backup partition found");
        return false;
    }

    esp_app_desc_t desc;
    if (esp_ota_get_partition_description(next, &desc) != ESP_OK) {
        APP_PRINTLN("[OTA] Rollback failed: backup partition has no valid app");
        return false;
    }

    APP_LOG("[OTA] Rolling back to partition: %s", next->label);

    if (esp_ota_set_boot_partition(next) != ESP_OK) {
        APP_PRINTLN("[OTA] Rollback failed: could not set boot partition");
        return false;
    }

    APP_PRINTLN("[OTA] Rollback OK. Rebooting...");
    return true;
}

static String g_otaRemoteVersion = "";
static String g_otaChangelog = "";
static String g_otaValidatedUrl = "";
static bool g_otaUpdateFound = false;
static unsigned long g_lastOtaCheck = 0;

/**
 * @brief 内部函数：获取并校验下载链接
 * @return true: 链接有效, false: 获取失败
 *
 * W8 安全说明：当前使用 setInsecure() 跳过 TLS 证书验证，存在中间人攻击风险。
 * 生产环境建议：在此处通过 client.setCACert(OTA_SERVER_CA_CERT) 固定服务器根证书。
 * 示例（以 Cloudflare 为例）：
 *   static const char OTA_SERVER_CA_CERT[] PROGMEM = "-----BEGIN CERTIFICATE-----\n...";
 *   client.setCACert(OTA_SERVER_CA_CERT);
 */
inline bool validateFirmwareExistence() {
    if (g_otaRemoteVersion == "") return false;

    WiFiClientSecure client;
    // TODO(W8): 生产环境请替换为 client.setCACert(OTA_SERVER_CA_CERT)
    client.setInsecure();
    HTTPClient http;
    String checkUrl = g_otaApiBase + "/api/ota/check?project=anycontrol&chip=ESP32C3";
    
    APP_LOG("[OTA] Refreshing URL: %s", checkUrl.c_str());
    http.begin(client, checkUrl);
    http.setUserAgent("Mozilla/5.0 AnyControl-Validator");
    int httpCode = http.GET();
    
    bool success = false;
    if (httpCode == 200) {
        DynamicJsonDocument doc(4096);
        deserializeJson(doc, http.getString());
        g_otaValidatedUrl = doc["url"] | ""; 
        if (g_otaValidatedUrl != "") success = true;
    } else {
        APP_LOG("[OTA] Validation failed, HTTP Code: %d", httpCode);
    }
    http.end();
    return success;
}

/**
 * @brief 检查是否存在新版本
 *
 * W8 安全说明：同上，生产环境请配置 CA 证书固定。
 */
inline int checkOtaUpdate() {
    if (WiFi.status() != WL_CONNECTED) return -2;

    WiFiClientSecure client;
    // TODO(W8): 生产环境请替换为 client.setCACert(OTA_SERVER_CA_CERT)
    client.setInsecure();
    HTTPClient http;
    String checkUrl = g_otaApiBase + "/api/ota/check?project=anycontrol&chip=ESP32C3";

    if (!http.begin(client, checkUrl)) return -1;
    http.setUserAgent("Mozilla/5.0 AnyControl-Collector/" FIRMWARE_VERSION);
    int httpCode = http.GET();

    if (httpCode == 200) {
        DynamicJsonDocument doc(4096);
        DeserializationError err = deserializeJson(doc, http.getString());
        if (err) {
            APP_LOG("[OTA] JSON parse error: %s", err.c_str());
            http.end();
            return -1;
        }

        g_otaRemoteVersion = doc["version"] | "";
        g_otaChangelog = doc["changelog"] | "";
        g_otaValidatedUrl = doc["url"] | "";

        // 统一去除可能存在的前缀 'v'/'V' 后进行版本差异比对
        String cleanRemote = g_otaRemoteVersion;
        if (cleanRemote.startsWith("v") || cleanRemote.startsWith("V")) {
            cleanRemote = cleanRemote.substring(1);
        }
        String cleanLocal = String(FIRMWARE_VERSION);
        if (cleanLocal.startsWith("v") || cleanLocal.startsWith("V")) {
            cleanLocal = cleanLocal.substring(1);
        }

        if (cleanRemote.length() > 0 && cleanRemote != cleanLocal) {
            g_otaUpdateFound = true;
            return 1;
        }
        g_otaUpdateFound = false;
        return 0;
    }
    return -1;
}

inline void otaAutoCheckLoop() {
    static bool firstCheckDone = false;
    unsigned long now = millis();
    if (!firstCheckDone && now > 30000) {
        if (WiFi.status() == WL_CONNECTED) {
            checkOtaUpdate();
            g_lastOtaCheck = now;
            firstCheckDone = true;
        }
    }
    if (now - g_lastOtaCheck > 86400000) {
        if (WiFi.status() == WL_CONNECTED) {
            checkOtaUpdate();
            g_lastOtaCheck = now;
        }
    }
}

/**
 * @brief 执行固件更新 (使用已预检的链接)
 */
inline void executeFirmwareUpdate() {
    if (g_otaValidatedUrl == "") return;

    // 升级前保存当前版本号到 NVS，供回滚时读取
    Preferences p;
    p.begin("anycontrol", false);
    p.putString("prevFwVer", FIRMWARE_VERSION);
    p.end();

    WiFiClientSecure client;
    client.setInsecure();

    APP_LOG("[OTA] Starting Update with validated URL...");
    
    httpUpdate.onProgress([](size_t progress, size_t total) {
        Serial.printf("[OTA] Updating: %d%%\r", (progress * 100) / total);
    });

    t_httpUpdate_return ret = httpUpdate.update(client, g_otaValidatedUrl);
    if (ret == HTTP_UPDATE_FAILED) {
        APP_LOG("[OTA] Fatal Error: %s", httpUpdate.getLastErrorString().c_str());
        delay(3000);
    }
    ESP.restart();
}
