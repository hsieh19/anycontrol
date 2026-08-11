# 固件版本更新日志 (Firmware Changelog)

本文件专门记录 **AnyControl ESP32-C3 智能网关嵌入式固件** 的版本迭代历史，遵循 [Semantic Versioning (语义化版本 2.0.0)](https://semver.org/lang/zh-CN/) 规范。

---

## [v1.0.1] - 2026-08-11

### 🐛 缺陷修复 (Fixed)
- **修复 OTA 检查更新时 changelog 无法显示的问题**：
  - 将 ESP32 OTA 侧 JSON 解析缓冲区从 512 字节扩大至 4096 字节，彻底解决 changelog 因缓冲区溢出被丢弃的问题；
  - 增加 JSON 反序列化错误检测，解析失败时记录详细日志便于排查；
  - 优化更新日志展示排版：增加最大高度限制与滚动支持，changelog 空时显示友好提示。
- **修复 OTA 版本号重复 `v` 前缀问题 (`vv1.0.0`)**：
  - 统一前端版本号展示逻辑，无论服务端返回的版本是 `v1.0.0` 还是 `1.0.0`，界面均规范显示为单一 `v` 前缀格式。
- **修复 release_time 时区错误（UTC 偏移 -8 小时）**：
  - 发布时间从 UTC 零时区改为东八区（`Asia/Shanghai`，`+08:00` 格式），与中国北京时间完全对齐。

---

## [v1.0.0] - 2026-08-11

### ✨ 新增特性 (Added)
- **ESP32-C3 双路 RS485 防碰撞中继 (Dual-Master Relay)**：
  - `UART0 (GPIO20/21)` 对接原物理主站/触摸屏；
  - `UART1 (GPIO2/10)` 对接现场 RS485 从站总线；
  - `WiFi TCP (Port 9502)` 作为上位机主站 2 并发接入，实现硬件级时间切片防碰撞转发。
- **全套网络模式与静态 IP 支持**：
  - 支持现场 WiFi STA 自动重连与静态 IP (IP/Mask/Gateway/DNS) 绑定；
  - WiFi 异常断开时自愈回退到 `AnyControl_AP` 热点配网模式。
- **内置 Web 管理控制台 (Port 80)**：
  - 提供 CPU 频率、内存占用、Flash 占用、WiFi 信号强度、芯片结温与运行时间 6 大核心监控指标；
  - 支持热重载串口波特率、数据位、校验位、停止位及心跳周期；
  - 优化 OTA 地址输入排版，支持全宽响应式展示与动态即时校验。
- **AnyFlash OTA 在线升级与安全双分区回滚 (A/B Partition)**：
  - 对接 AnyFlash Serverless 分发网关（带 HMAC 签名与 10 分钟时效防护）；
  - 支持 ESP32 A/B 双分区无缝热升级与一键回滚历史版本。
