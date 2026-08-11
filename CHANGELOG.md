# Changelog

本项目的版本记录严格遵循 [Semantic Versioning (语义化版本 2.0.0)](https://semver.org/lang/zh-CN/) 规范。

---

## [v1.0.0] - 2026-08-11

### ✨ 新增功能 (Added)
- **ESP32-C3 双路 RS485 防碰撞中继**：
  - `UART0 (GPIO20/21)` 对接原物理主站/触摸屏；
  - `UART1 (GPIO2/10)` 对接现场 RS485 从站总线；
  - `WiFi TCP (Port 9502)` 作为上位机主站 2 并发接入，实现硬件级时间切片防碰撞转发。
- **全套网络模式与静态 IP 支持**：
  - 支持现场 WiFi STA 自动重连与静态 IP (IP/Mask/Gateway/DNS) 绑定；
  - WiFi 异常断开时自愈回退到 `AnyControl_AP` 热点配网模式。
- **内置 Web 管理控制台 (Port 80)**：
  - 提供 CPU 频率、内存占用、Flash 占用、WiFi 信号强度、芯片结温与运行时间 6 大核心监控指标；
  - 支持热重载串口波特率、数据位、校验位、停止位及心跳周期；
  - 输入框实时回显当前生效的网络参数。
- **AnyFlash OTA 在线升级与安全双分区回滚**：
  - 对接 AnyFlash Serverless 分发网关（带 HMAC 签名与 10 分钟时效防护）；
  - 支持 ESP32 A/B 双分区无缝升级与一键回滚上一个版本。
