# ===================================================
# AnyControl 工业设备控制与审计平台 - 生产级 Dockerfile
# 多阶段构建：基于 Debian Slim (glibc)，工业级稳定性，完美支持 C++ 原生扩展
# ===================================================

# ---------------------------------------------------
# Stage 1: 构建前端静态资源 (Client Build)
# ---------------------------------------------------
FROM node:22-bookworm-slim AS client-builder
WORKDIR /app/client

# 安装依赖
COPY client/package*.json ./
RUN npm ci

# 复制源码并构建
COPY package.json /app/package.json
COPY client/ ./
RUN npm run build

# ---------------------------------------------------
# Stage 2: 构建后端 TypeScript 代码及原生 SQLite 模块 (Server Build)
# ---------------------------------------------------
FROM node:22-bookworm-slim AS server-builder
WORKDIR /app/server

# 安装 node-gyp 原生 C++ 编译工具链 (供 better-sqlite3 源码编译)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# 安装依赖并强制从源码编译原生模块
COPY server/package*.json ./
RUN npm ci && npm rebuild better-sqlite3 --build-from-source

COPY server/ ./
RUN npm run build

# 清理 devDependencies 保留生产所需 node_modules
RUN npm prune --production

# ---------------------------------------------------
# Stage 3: 生产运行时镜像 (Production Runtime)
# ---------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# 设置时区为亚洲/上海 (工业环境标准)
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && ln -fs /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && dpkg-reconfigure -f noninteractive tzdata \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app/server

# 复制生产依赖与编译产物
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/package.json ./package.json

# 确保 SQLite 数据库挂载目录存在
RUN mkdir -p /app/server/data

# 复制前端编译产物 (供后端静态托管)
WORKDIR /app
COPY --from=client-builder /app/client/dist ./client/dist

# 暴露服务端口 (HTTP API / SPA 界面 / WebSocket 审计)
EXPOSE 3000

WORKDIR /app/server

# 容器启动入口
CMD ["node", "dist/index.js"]
