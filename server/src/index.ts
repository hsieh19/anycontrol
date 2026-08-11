import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// 全局异常捕获，确保异常能输出完整堆栈而非静默退出
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] 未捕获的同步异常 (uncaughtException):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] 未处理的异步 Promise 拒绝 (unhandledRejection):', reason);
});

// 仅在本地开发环境中存在 .env 文件时加载，避免生产环境刷屏提示
const rootEnvPath = path.resolve(__dirname, '../../.env');
const localEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, quiet: true });
} else if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, quiet: true });
}

import express from 'express';
import http from 'http';
import cors from 'cors';
import { apiRouter } from './routes';
import { wsManager } from './infrastructure/wsServer';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API 路由挂载
app.use('/api', apiRouter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 托管前端静态资源 (生产环境单容器部署)
const clientDistPath = path.join(__dirname, '../../client/dist');
const altClientDistPath = path.join(__dirname, '../client/dist');
const finalStaticPath = fs.existsSync(clientDistPath) ? clientDistPath : (fs.existsSync(altClientDistPath) ? altClientDistPath : null);

if (finalStaticPath) {
  app.use(express.static(finalStaticPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(finalStaticPath, 'index.html'));
  });
}

const server = http.createServer(app);

// 挂载 WebSocket 实时广播服务
wsManager.init(server);

// 启动服务
async function bootstrap() {
  try {
    server.listen(Number(port), '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(` AnyControl 工业网关与控制后端服务已就绪 (0.0.0.0)`);
      console.log(` 本地回环访问: http://127.0.0.1:${port}/api`);
      console.log(` 实时审计 WebSocket: ws://127.0.0.1:${port}/ws`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('服务启动失败:', err);
    process.exit(1);
  }
}

bootstrap();
