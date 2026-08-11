/*
 * AnyControl ESP32-C3 工业双主站中继与 OTA 网关固件
 *
 * 架构说明：
 * - 物理硬件：ESP32-C3
 * - 串口通道：
 *     UART0 (GPIO20/GPIO21) -> 连接原物理主站 RS485_A
 *     UART1 (GPIO2/GPIO10)  -> 连接现场物理从站总线 RS485_B
 * - 无线接口：WiFi (STA / AP 自适应) -> TCP Server (端口 9502) 作为 Master 2 接入
 * - 网页服务：内置 WebServer (端口 80) 提供状态监控、串口/网络参数配置、OTA 升级与固件回滚
 */

#include "Config.h"

void setup() {
    anycontrolHardwareInit();
}

void loop() {
    anycontrolGatewayLoop();
}
