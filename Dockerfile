# ===================================================
# AnyControl 工业设备控制与审计平台 - 生产级 Dockerfile
# 多阶段构建：极致轻量化 (基于 Alpine Linux)、高安全性
# ===================================================

# ---------------------------------------------------
# Stage 1: 构建前端静态资源 (Client Build)
# ---------------------------------------------------
FROM node:20-alpine AS client-builder
WORKDIR /app/client

# 安装依赖
COPY client/package*.json ./
RUN npm ci

# 复制源码并构建
COPY client/ ./
RUN npm run build

# ---------------------------------------------------
# Stage 2: 构建后端 TypeScript 代码 (Server Build)
# ---------------------------------------------------
FROM node:20-alpine AS server-builder
WORKDIR /app/server

# 安装依赖
COPY server/package*.json ./
RUN npm ci

# 复制源码并编译 TypeScript -> JavaScript
COPY server/ ./
RUN npm run build

# ---------------------------------------------------
# Stage 3: 生产运行时镜像 (Production Runtime)
# ---------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# 设置时区为亚洲/上海 (工业环境标准)
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

ENV NODE_ENV=production
ENV PORT=3000

# 仅安装后端生产运行依赖
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --only=production

# 复制编译后的后端产物
COPY --from=server-builder /app/server/dist ./dist

# I7 修复：不将 data 目录打包进镜像，由 docker-compose volume 挂载提供
# 确保镜像中 data 目录存在（首次启动 Volume 为空时 db.ts 会自动初始化）
RUN mkdir -p /app/server/data

# 复制前端编译产物 (供后端静态托管)
WORKDIR /app
COPY --from=client-builder /app/client/dist ./client/dist

# 暴露服务端口 (HTTP API / SPA 界面 / WebSocket 审计)
EXPOSE 3000

WORKDIR /app/server

# 容器启动入口
CMD ["node", "dist/index.js"]
