import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { AuditLog } from '../domain/types';

export class WsBroadcastManager {
  private wss: WebSocketServer | null = null;

  public init(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      // console.log('[WebSocket] 监控客户端建立连接');
      
      // 发送连接就绪心跳包
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'AnyControl WebSocket 审计通道就绪', timestamp: new Date().toISOString() }));

      ws.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          }
        } catch (e) {}
      });

      ws.on('close', () => {
        // console.log('[WebSocket] 客户端断开连接');
      });
    });

    console.log('[WebSocket] 实时审计广播服务已挂载在 /ws');
  }

  public broadcastAuditLog(log: AuditLog) {
    if (!this.wss) return;

    const payload = JSON.stringify({
      type: 'AUDIT_LOG',
      data: log
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  public broadcastDeviceStatus(deviceId: string, status: 'ONLINE' | 'OFFLINE' | 'BUSY') {
    if (!this.wss) return;

    const payload = JSON.stringify({
      type: 'DEVICE_STATUS',
      data: { deviceId, status, timestamp: new Date().toISOString() }
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}

export const wsManager = new WsBroadcastManager();
