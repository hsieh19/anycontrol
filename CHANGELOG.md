# 软件平台更新日志 (Software Platform Changelog)

本文件专门记录 **AnyControl 工业控制与审计软件平台**（包含 Vue 3 前端界面、Node.js/TS 核心服务与 SQLite 数据库）的版本变更记录，遵循 [Semantic Versioning (语义化版本 2.0.0)](https://semver.org/lang/zh-CN/) 规范。

*(注：ESP32-C3 嵌入式固件的变更日志请参阅 [firmware/CHANGELOG.md](firmware/CHANGELOG.md))*

---

## [v1.0.0] - 2026-08-11

### ✨ 核心功能 (Added)
- **工业控制台与受控设备管理**：
  - 响应式树状设备拓扑视图（网关/从站设备/点位）；
  - 支持线圈（FC05）与保持寄存器（FC06/FC16）交互控制；
  - 闭环物理回读校验机制（带容差与执行耗时毫秒级计量）。
- **32位跨寄存器与字节序编解码**：
  - 原生支持 `UINT32`、`INT32`、`FLOAT32` 高低字组包；
  - 支持 `ABCD`、`CDAB`、`BADC`、`DCBA` 四种 Modbus 字节序转换。
- **全量操作审计与 WebSocket 广播**：
  - 自动记录操作员、变更前原始值、下发设定值、物理回读值及网关 IP；
  - WebSocket (`/ws`) 实时推送操作日志流。
- **企业级安全鉴权与 SSO**：
  - 全量 API 受 JWT（8小时时效）保护，密码使用 `bcrypt` 哈希加密；
  - 支持企业自建飞书应用 OAuth2 扫码登录与免登绑定；
  - 角色权限隔离（`ADMIN`, `OPERATOR`, `AUDITOR`, `VIEWER`）。
- **SQLite (WAL 模式) 高性能存储引擎**：
  - 单文件便携数据库，彻底替代 JSON 文件读写，高频控制零锁死；
  - 历史数据自动平滑迁移与一键全量 JSON 备份/灾难恢复。
- **Docker 生产级部署**：
  - Alpine Linux 多阶段构建镜像，原生 SQLite 模块自动编译；
  - 配置直接在 `docker-compose.yml` 中直观管理。
