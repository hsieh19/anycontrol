#pragma once

#include "Globals.h"

/**
 * @brief 双主站中继网关核心处理逻辑 (DUAL_MASTER)
 *
 * 拓扑结构：
 * - RS485_A (物理原主站): 使用 UART0 (Serial0)，引脚映射为 RX: GPIO20, TX: GPIO21
 * - RS485_B (物理现场从站): 使用 UART1 (RS485Serial)，引脚为 RX: GPIO2, TX: GPIO10
 * - WiFi 客户端 (Master 2): 监听 TCP Port (dmWPort / 默认 9502)
 *
 * 两路主站物理/逻辑隔离，网关在内部进行互斥式调度，避免总线碰撞。
 */

static WiFiServer* s_dmWifiServer = nullptr;
static WiFiClient s_dmWifiClients[2];

// 模块私有总线互斥锁，保护 UART1 (RS485_B)
static volatile bool s_busBusy = false;

// 串口 RX 缓存
static uint8_t s_masterRxBuf[260];
static size_t s_masterRxLen = 0;
static unsigned long s_masterLastByteMs = 0;

// CRC16 (Modbus RTU) 校验计算
static uint16_t s_calculateCRC(const uint8_t* buf, int len) {
    uint16_t crc = 0xFFFF;
    for (int pos = 0; pos < len; pos++) {
        crc ^= (uint16_t)buf[pos];
        for (int i = 8; i != 0; i--) {
            if ((crc & 0x0001) != 0) {
                crc >>= 1;
                crc ^= 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    return crc;
}

static void reconfigDualMasterSerial() {
    // 1. 初始化 UART0 用于连接原主站 (GPIO20/21)
    MasterSerial.flush();
    MasterSerial.end();
    delay(20);

    uint32_t config = SERIAL_8N1;
    if (g_dualMasterConfig.masterData == 8) {
        if (g_dualMasterConfig.masterParity == 1) 
            config = (g_dualMasterConfig.masterStop == 1) ? SERIAL_8E1 : SERIAL_8E2;
        else if (g_dualMasterConfig.masterParity == 2) 
            config = (g_dualMasterConfig.masterStop == 1) ? SERIAL_8O1 : SERIAL_8O2;
        else 
            config = (g_dualMasterConfig.masterStop == 1) ? SERIAL_8N1 : SERIAL_8N2;
    } else {
        if (g_dualMasterConfig.masterParity == 1) 
            config = (g_dualMasterConfig.masterStop == 1) ? SERIAL_7E1 : SERIAL_7E2;
        else if (g_dualMasterConfig.masterParity == 2) 
            config = (g_dualMasterConfig.masterStop == 1) ? SERIAL_7O1 : SERIAL_7O2;
        else 
            config = (g_dualMasterConfig.masterStop == 1) ? SERIAL_7N1 : SERIAL_7N2;
    }

    // 利用硬件引脚矩阵重新配置并开启 UART0
    MasterSerial.begin(g_dualMasterConfig.masterBaud, config, PIN_MASTER_RX, PIN_MASTER_TX);

    // 2. 初始化 UART1 用于连接物理从站 (RS485_B)
    RS485Serial.flush();
    RS485Serial.end();
    delay(20);
    RS485Serial.begin(g_dualMasterConfig.masterBaud, config, PIN_RS485_RX, PIN_RS485_TX);

    APP_LOG("[DM] RS485 Serial updated: Baud=%u, Data=%d, Parity=%d, Stop=%d",
            g_dualMasterConfig.masterBaud, g_dualMasterConfig.masterData,
            g_dualMasterConfig.masterParity, g_dualMasterConfig.masterStop);
}

static void initDualMasterMode() {
    reconfigDualMasterSerial();

    // 3. 启动 WiFi Master 2 TCP 服务监听
    if (s_dmWifiServer) {
        delete s_dmWifiServer;
        s_dmWifiServer = nullptr;
    }
    s_dmWifiServer = new WiFiServer(g_dualMasterConfig.wifiPort);
    s_dmWifiServer->begin();

    APP_LOG("[DM] Dual Master Relay initialized. WiFi Port: %u", g_dualMasterConfig.wifiPort);
}

// 转发并在 RS485_B 上等待从站响应 (带自适应超时与断帧判断)
static size_t forwardAndCollectResponse(const uint8_t* reqBuf, size_t reqLen, uint8_t* respBuf, size_t maxRespLen, unsigned long timeoutMs) {
    // 清空从站接收缓冲区残留
    while (RS485Serial.available() > 0) {
        RS485Serial.read();
    }

    // 写入物理从站总线
    RS485Serial.write(reqBuf, reqLen);
    RS485Serial.flush();

    size_t respLen = 0;
    unsigned long startTime = millis();
    unsigned long lastByteTime = millis();
    const unsigned long frameTimeoutMs = 20; // 字符间断帧时间 20ms

    while (millis() - startTime < timeoutMs) {
        if (RS485Serial.available()) {
            respBuf[respLen++] = RS485Serial.read();
            lastByteTime = millis();
            if (respLen >= maxRespLen) break;
        } else if (respLen > 0 && (millis() - lastByteTime > frameTimeoutMs)) {
            break;
        }
        delay(1);
    }
    if (respLen > 0) {
        g_lastBusLatencyMs = millis() - startTime;
    }
    return respLen;
}

// 调度 WiFi 客户端的请求 (Modbus TCP -> RTU 转换并回传)
static void processWifiMasterClient(WiFiClient& client) {
    if (!client || !client.connected()) return;

    // Modbus TCP 报头至少 7 字节
    if (client.available() >= 7) {
        uint8_t mbap[7];
        client.read(mbap, 7);

        uint16_t tid = (mbap[0] << 8) | mbap[1];
        uint16_t pid = (mbap[2] << 8) | mbap[3];
        uint16_t len = (mbap[4] << 8) | mbap[5];
        uint8_t uid = mbap[6];

        // 仅处理 Modbus 协议 (Protocol ID = 0)
        if (pid == 0 && len > 0 && len < 250) {
            uint8_t rtuFrame[260];
            rtuFrame[0] = uid;
            int pduLen = 1;
            unsigned long waitStart = millis();

            // 接收剩余 PDU 载荷
            while (pduLen < len && (millis() - waitStart < 50)) {
                if (client.available()) {
                    rtuFrame[pduLen++] = client.read();
                }
            }

            if (pduLen == len) {
                // 计算并添加 RTU CRC16
                uint16_t crc = s_calculateCRC(rtuFrame, len);
                rtuFrame[len] = crc & 0xFF;
                rtuFrame[len + 1] = crc >> 8;

                // 互斥抢占 RS485_B 总线
                unsigned long startLockWait = millis();
                while (s_busBusy && (millis() - startLockWait < 1000)) {
                    delay(1);
                }

                if (!s_busBusy) {
                    s_busBusy = true;
                    uint8_t respBuf[260];
                    size_t respLen = forwardAndCollectResponse(rtuFrame, len + 2, respBuf, sizeof(respBuf), 200);
                    s_busBusy = false;

                    // 验证从站响应 CRC16 并发回 TCP 响应
                    if (respLen >= 4) {
                        uint16_t rxCrc = (respBuf[respLen - 1] << 8) | respBuf[respLen - 2];
                        if (s_calculateCRC(respBuf, respLen - 2) == rxCrc) {
                            g_master2FrameCount++;
                            uint8_t tcpResp[260];
                            tcpResp[0] = (tid >> 8);
                            tcpResp[1] = (tid & 0xFF);
                            tcpResp[2] = 0; 
                            tcpResp[3] = 0;
                            uint16_t payloadLen = respLen - 2;
                            tcpResp[4] = (payloadLen >> 8);
                            tcpResp[5] = (payloadLen & 0xFF);
                            memcpy(&tcpResp[6], respBuf, payloadLen);

                            client.write(tcpResp, payloadLen + 6);
                            client.flush();
                        } else {
                            g_busCrcErrorCount++;
                        }
                    }
                }
            }
        }
    }
}

static void dualMasterLoop() {
    static bool dmStarted = false;
    if (!dmStarted) {
        initDualMasterMode();
        dmStarted = true;
    }

    // === 1. 拦截原物理主站 (UART0 / MasterSerial) 请求 ===
    while (MasterSerial.available() > 0 && s_masterRxLen < sizeof(s_masterRxBuf)) {
        s_masterRxBuf[s_masterRxLen++] = MasterSerial.read();
        s_masterLastByteMs = millis();
    }

    // 满足断帧条件 (超过 15ms 且无新数据，或缓冲区满)
    if (s_masterRxLen > 0 && (millis() - s_masterLastByteMs > 15 || s_masterRxLen >= sizeof(s_masterRxBuf))) {
        if (s_masterRxLen >= 4) {
            uint16_t rxCrc = (s_masterRxBuf[s_masterRxLen - 1] << 8) | s_masterRxBuf[s_masterRxLen - 2];
            // 验证 CRC 确保是一帧正确的 Modbus RTU 请求
            if (s_calculateCRC(s_masterRxBuf, s_masterRxLen - 2) == rxCrc) {
                // 独占锁定总线
                s_busBusy = true;
                uint8_t respBuf[260];
                size_t respLen = forwardAndCollectResponse(s_masterRxBuf, s_masterRxLen, respBuf, sizeof(respBuf), 1000);
                s_busBusy = false;

                // 若有响应且有效，发回原主站
                if (respLen >= 4) {
                    uint16_t txCrc = (respBuf[respLen - 1] << 8) | respBuf[respLen - 2];
                    if (s_calculateCRC(respBuf, respLen - 2) == txCrc) {
                        g_master1FrameCount++;
                        MasterSerial.write(respBuf, respLen);
                        MasterSerial.flush();
                    } else {
                        g_busCrcErrorCount++;
                    }
                }
            }
        }
        s_masterRxLen = 0; // 重置缓存
    }

    // === 2. 调度 WiFi 客户端 (Master 2) ===
    if (s_dmWifiServer) {
        WiFiClient newClient = s_dmWifiServer->accept();
        if (newClient) {
            bool ok = false;
            for (int i = 0; i < 2; i++) {
                if (!s_dmWifiClients[i] || !s_dmWifiClients[i].connected()) {
                    s_dmWifiClients[i] = newClient;
                    ok = true;
                    break;
                }
            }
            if (!ok) newClient.stop();
        }

        for (int i = 0; i < 2; i++) {
            processWifiMasterClient(s_dmWifiClients[i]);
        }
    }
}
