# 软件平台更新日志 (Software Platform Changelog)

本文件专门记录 **AnyControl 工业控制与审计软件平台**（包含 Vue 3 前端界面、Node.js/TS 核心服务与 SQLite 数据库）的版本变更记录，遵循 [Semantic Versioning (语义化版本 2.0.0)](https://semver.org/lang/zh-CN/) 规范。

*(注：ESP32-C3 嵌入式固件的变更日志请参阅 [firmware/CHANGELOG.md](firmware/CHANGELOG.md))*

---

## [v1.0.1] - 2026-08-11

### 🐛 缺陷修复 (Fixed)
- **修复 Docker 生产容器段错误崩溃 (SIGSEGV Exit 139)**：
  - 生产构建与运行基础镜像全面迁移至官方标准 `node:20-bookworm-slim`（基于 Debian glibc）；
  - 在 `server-builder` 阶段补充 `python3 make g++` 编译工具链，确保 node-gyp 原生编译顺利完成；
  - 彻底解决 `better-sqlite3` 原生 C++ 扩展在 Alpine Linux (musl 1.2.5) 下触发的 ABI 二进制不兼容与内存段错误问题。
- **优化环境变量日志输出**：
  - 优化 `dotenv` 在无 `.env` 配置文件环境下的静默处理，去除启动时的多行无意义提示。
- **增强后端异常监控**：
  - 注册 `uncaughtException` 与 `unhandledRejection` 全局监听，防止 Node.js 底层异常静默退出。

### ⚡ 部署与运维优化 (Changed)
- **优化 `docker-compose.yml` 编排文件**：
  - 移除本地 `build:` 构建段，生产环境直接通过 GitHub Packages (GHCR) 拉取最新多架构镜像部署；
  - 更新常用运维命令说明。

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
