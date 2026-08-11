# ⚡ AnyControl (工业智能网关与控制审计平台)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node: >=20](https://img.shields.io/badge/Node->=20-green.svg)](https://nodejs.org/)
[![Hardware: ESP32-C3](https://img.shields.io/badge/Hardware-ESP32--C3-red.svg)](https://www.espressif.com/)
[![Database: SQLite WAL](https://img.shields.io/badge/Database-SQLite%20WAL-orange.svg)](https://www.sqlite.org/)

**AnyControl** 是一套面向现代工业现场的高可靠设备控制、参数下发与操作全量审计平台。系统深度融合了 **ESP32-C3 双主站中继网关固件** 与 **Node.js/TypeScript/Vue 3 边缘工控软件栈**，彻底解决了工业现场“多主站总线竞争冲突”、“下发控制无物理闭环验证”以及“现场操作缺失责任审计”等核心痛点。

---

## 🌟 核心特性

### 1. 🛡️ 工业级双主站无冲突中继 (Dual-Master Relay)
- **物理与逻辑解耦**：硬件网关同时连接**原物理主站/触摸屏**（RS485_A，UART0）与**现场从站总线**（RS485_B，UART1）。
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

### 5. ⚡ 嵌入式双分区在线更新 (A/B OTA)
- **A/B 分区无缝热升级**：固件内置 OTA 检测与双分区切换机制，升级失败或异常支持一键回滚历史版本。

---

## 📐 系统架构与拓扑

```
 ┌─────────────────────────────────────────────────────────────┐
 │                AnyControl 前端控制台 (Vue 3 SPA)             │
 └──────────────────────────────┬──────────────────────────────┘
                                │ HTTP REST / WebSocket
 ┌──────────────────────────────▼──────────────────────────────┐
 │              AnyControl 后端服务 (Node.js / TS)             │
 │   - JWT 鉴权中间件        - Modbus Client 串行排队           │
 │   - SQLite (WAL模式)      - WebSocket 实时广播服务           │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Modbus TCP (Port: 9502)
 ┌──────────────────────────────▼──────────────────────────────┐
 │             ESP32-C3 智能中继网关 (AnyControl 固件)           │
 │  ┌──────────────────────┐        ┌───────────────────────┐  │
 │  │ UART0 (GPIO20/21)    │        │ UART1 (GPIO2/10)      │  │
 │  │ 原物理主站/触摸屏(A)  │        │ 现场物理从站总线 (B)  │  │
 │  └──────────────────────┘        └───────────────────────┘  │
 └─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 技术技术栈

| 模块 | 核心技术 | 说明 |
| :--- | :--- | :--- |
| **前端 (Client)** | Vue 3 + TypeScript + Vite + Pinia + Element Plus | 现代化响应式工业监控界面 |
| **后端 (Server)** | Node.js + Express + TypeScript + `better-sqlite3` + `modbus-serial` | 高并发、高可靠工控后端 |
| **存储 (Database)** | SQLite 3 (WAL 模式) | 单文件便携部署、ACID 事务、掉电安全 |
| **固件 (Firmware)** | ESP32-C3 + Arduino Core / ESP-IDF | 双串口中继、WebServer、A/B OTA |
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

## 🔌 固件烧录与硬件引脚说明 (ESP32-C3)

| 引脚功能 | GPIO 编号 | 物理连接 |
| :--- | :--- | :--- |
| **RS485_A RX** (原主站) | `GPIO20` | 连接原触摸屏/主站 RS485 转换芯片 RO |
| **RS485_A TX** (原主站) | `GPIO21` | 连接原触摸屏/主站 RS485 转换芯片 DI |
| **RS485_B RX** (现场从站) | `GPIO2` | 连接现场从站总线 RS485 转换芯片 RO |
| **RS485_B TX** (现场从站) | `GPIO10` | 连接现场从站总线 RS485 转换芯片 DI |

使用 Arduino IDE 或 PlatformIO 打开 `firmware/firmware.ino`，选择开发板 **ESP32C3 Dev Module** 编译并烧录即可。

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
├── firmware/            # ESP32-C3 双主站中继网关固件源码
│   ├── Config.h         # 硬件引脚与顶层生命周期
│   ├── DualMasterHandler.h # 双主站无冲突中继核心调度器
│   ├── OtaHandler.h     # A/B 分区在线升级与回滚
│   └── WebHandler.h     # 嵌入式 Web 配置与状态监控页面
├── Dockerfile           # 生产级多阶段构建 Dockerfile
└── docker-compose.yml   # 容器化部署编排配置
```

---

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 授权协议。
