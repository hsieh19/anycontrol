# ⚡ AnyControl (工业智能网关与控制审计平台)

[![Version: 1.0.3](https://img.shields.io/badge/Version-1.0.3-brightgreen.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node: >=20](https://img.shields.io/badge/Node->=20-green.svg)](https://nodejs.org/)
[![Gateway: AnyPort-ESP32](https://img.shields.io/badge/Gateway-AnyPort--ESP32-red.svg)](https://github.com/hsieh19/anyport-esp32)
[![Database: SQLite WAL](https://img.shields.io/badge/Database-SQLite%20WAL-orange.svg)](https://www.sqlite.org/)

**AnyControl** 是一套面向现代工业现场的高可靠设备控制、参数下发与操作全量审计平台。系统与 **[AnyPort-ESP32](https://github.com/hsieh19/anyport-esp32)**（Mode 6 双主站中继网关）深度联动，基于现代化 **Node.js/TypeScript/Vue 3 边缘工控软件栈**，彻底解决了工业现场“多主站总线竞争冲突”、“下发控制无物理闭环验证”以及“现场操作缺失责任审计”等核心痛点。

---

## 🌟 核心特性

### 1. 🛡️ 工业级双主站无冲突中继 (Dual-Master Relay)
- **物理与逻辑解耦**：硬件网关同时连接**原物理主站/触摸屏**（RS485_A）与**现场从站总线**（RS485_B）。
- **云端/上位机并发接入**：WiFi 开启 TCP Server（端口 9502）作为上位机接入通道（Master 2）。
- **微秒级互斥调度**：网关内部自适应抢占与断帧调度，避免两路主站同时发送造成总线碰撞与乱码。

### 2. 🔄 闭环物理回读校验 (Closed-Loop Safe Write)
- **写后即读验证**：下发线圈（FC05）或寄存器（FC06/FC16）后，自动向物理设备发起回读校验，确保执行到位。
- **32位与字节序全兼容**：支持 `UINT32`、`INT32`、`FLOAT32` 跨双寄存器自动拆包/组包，支持 `ABCD`、`CDAB`、`BADC`、`DCBA` 四种字节序转换。
- **总线串行排队器**：每个网关独立配置 `concurrency: 1` 的排队执行器，防止并发指令冲撞。

### 3. 📝 全量操作审计与 WebSocket 实时广播
- **详细审计追溯**：记录操作员身份、变更前原始值、下发设定值、物理回读值、执行耗时（毫秒）及网关/从站 IP。
- **全局实时推流**：基于 WebSocket 实时广播操作日志与设备在线状态。

### 4. 🔐 严密安全体系与权限控制
- **JWT 身份鉴权**：接口全量受 JWT 保护，支持密码哈希（`bcrypt`）安全存储。
- **细粒度角色控制**：区分 `ADMIN`、`OPERATOR`、`AUDITOR`、`VIEWER` 角色权限。
- **飞书 SSO 免登**：支持企业自建飞书应用扫码登录与 OAuth 授权免登。
- **安全灾备**：系统全量配置一键导出与灾难恢复（仅限系统管理员）。

### 5. ⚡ 网关固件协同与在线维护
- **全生命周期维护**：配套网关基于 AnyPort-ESP32 架构，支持通过 Web 界面或云端进行在线配置热重载与 A/B 分区 OTA 升级。

---

## 📐 系统架构与拓扑

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                AnyControl 前端控制台 (Vue 3 SPA)             │
 └──────────────────────────────┬──────────────────────────────┘
                                │ HTTP REST / WebSocket
 ┌──────────────────────────────▼──────────────────────────────┐
 │              AnyControl 后端服务 (Node.js / TS)             │
 │   - JWT 鉴权中间件        - Modbus Client 串行排队           │
 │   - SQLite (WAL模式)      - WebSocket 实时广播服务           │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Modbus TCP (Port: 9502 / Master 2)
 ┌──────────────────────────────▼──────────────────────────────┐
 │         AnyPort-ESP32 智能中继网关 (Mode 6: DualMasterMode)   │
 │  ┌────────────────────────┐     ┌────────────────────────┐  │
 │  │   原物理主站 / 触摸屏   │     │    现场物理从站总线    │  │
 │  │       (Master 1)       │     │     (Modbus Slaves)    │  │
 │  └────────────────────────┘     └────────────────────────┘  │
 └─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 技术技术栈

| 模块 | 核心技术 | 说明 |
| :--- | :--- | :--- |
| **前端 (Client)** | Vue 3 + TypeScript + Vite + Pinia + Element Plus | 现代化响应式工业监控界面 |
| **后端 (Server)** | Node.js + Express + TypeScript + `better-sqlite3` + `modbus-serial` | 高并发、高可靠工控后端 |
| **存储 (Database)** | SQLite 3 (WAL 模式) | 单文件便携部署、ACID 事务、掉电安全 |
| **配套网关 (Gateway)** | [AnyPort-ESP32 (Mode 6)](https://github.com/hsieh19/anyport-esp32) | 硬件双 RS485 物理隔离、TCP 互斥仲裁、热重载与在线 OTA |
| **容器化 (DevOps)** | Docker + Docker Compose (基于 Alpine 多阶段构建) | 极致轻量化生产部署 |

---

## 🚀 快速上手指南

### 1. 环境准备
- Node.js >= 20.x
- npm 或 pnpm

### 2. 克隆仓库与安装依赖

```bash
git clone https://github.com/hsieh19/anycontrol.git
cd anycontrol

# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 3. 本地启动开发环境

```bash
# 启动后端服务 (终端 1)
cd server
npm run dev

# 启动前端界面 (终端 2)
cd client
npm run dev
```

浏览器访问 `http://localhost:5173`，默认初始管理员账号：`admin` / 密码：`admin123`（首次登录后建议立即改密）。

---

## 🐳 Docker 生产部署 (推荐)

项目所有生产参数均直接在 `docker-compose.yml` 中内嵌定义与注释，无需额外维护 `.env` 文件。

```bash
# 1. 根据实际环境按需编辑 docker-compose.yml 中的参数 (如 JWT_SECRET、飞书配置等)
# 2. 一键构建并启动服务
docker compose up -d --build
```

- 静态资源与 API 服务统一由 `3000` 端口对外暴露（可在 `docker-compose.yml` 中直接修改映射端口）。
- 数据库与运行期数据通过 Docker Volume `anycontrol-data` 挂载到 `/app/server/data`，重启与升级数据不丢失。

---

## 🔌 配套硬件网关 (AnyPort-ESP32)

AnyControl 上位机系统通过标准 Modbus TCP（默认端口 `9502`）与现场智能网关通信。

所有网关硬件选型、接线引脚定义、固件源码编译及 Web 在线烧录/OTA 均由 **[AnyPort-ESP32](https://github.com/hsieh19/anyport-esp32)** 项目统一发布与维护。

现场部署时，仅需将网关切换至 **模式 6（双主站防碰撞中继网关 / `DualMasterMode`）**，在 AnyControl 后台填写网关 IP 即可原生接入，实现无冲突的并联控制与闭环审计。

---

## 📁 目录结构

```text
anycontrol/
├── client/              # Vue 3 前端工程 (Vite + Pinia + Element Plus)
│   ├── src/api/         # 后端 API 接口与 Axios 拦截器 (自动携带 Token)
│   ├── src/stores/      # Pinia 全局状态与 WebSocket 实时监听
│   └── src/views/       # 控制台、设备管理、协议模板、用户与审计日志页面
├── server/              # Node.js / TypeScript 后端工程
│   ├── src/domain/      # 核心领域实体与类型定义
│   ├── src/infrastructure/# SQLite 数据库 (WAL)、Modbus 客户端与广播
│   ├── src/middleware/  # JWT 身份认证与角色鉴权中间件
│   ├── src/services/    # 设备服务、控制服务、协议服务、用户审计服务
│   └── src/routes.ts    # RESTful API 路由
├── Dockerfile           # 生产级多阶段构建 Dockerfile
└── docker-compose.yml   # 容器化部署编排配置

> 💡 **提示**：现场网关固件统一由 [AnyPort-ESP32](https://github.com/hsieh19/anyport-esp32) 项目（模式 6）独立开发与发布，AnyControl 不再包含任何硬件固件代码。
```

---

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 授权协议。
