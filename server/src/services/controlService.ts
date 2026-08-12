import { db } from '../infrastructure/db';
import { modbusClientManager } from '../infrastructure/modbusClient';
import { wsManager } from '../infrastructure/wsServer';
import { ControlCommandRequest, AuditLog, ControlPoint } from '../domain/types';

export class ControlService {
  /**
   * 下发 Modbus 控制指令 (带权限校验、串行排队与闭环回读校验)
   */
  public async executeCommand(req: ControlCommandRequest): Promise<{ success: boolean; message: string; log: AuditLog }> {
    const { operator = '现场操作员', deviceId, pointKey, value } = req;

    // 1. 获取受控设备信息
    const device = db.getDeviceById(deviceId);
    if (!device) {
      throw new Error(`受控设备 [${deviceId}] 不存在`);
    }

    // 2. 获取网关信息
    const gateway = db.getGatewayById(device.gatewayId);
    if (!gateway) {
      throw new Error(`设备所属网关 [${device.gatewayId}] 不存在`);
    }

    // 3. 获取协议模板与点位
    const template = db.getControlTemplateById(device.protocolTemplateId);
    if (!template) {
      throw new Error(`设备关联的协议模板 [${device.protocolTemplateId}] 不存在`);
    }

    const point = template.points.find(p => p.key === pointKey);
    if (!point) {
      throw new Error(`协议模板中未找到点位 [${pointKey}]`);
    }

    if (point.permission === 'RO') {
      throw new Error(`点位 [${point.name}] 为只读点位，禁止下发写入指令`);
    }

    // 4. 获取网关物理通讯参数端口与超时
    const port = gateway.port || 9502;
    const timeout = gateway.timeout || 2000;

    // 5. 下发前预读当前物理原始值 (修改前的值)
    let previousValue: number | boolean | null = null;
    if (point.permission !== 'WO') {
      try {
        const preRead = await modbusClientManager.executeSafeRead(
          gateway.id,
          gateway.ip,
          port,
          device.slaveId,
          point,
          timeout
        );
        if (preRead.success && preRead.value !== null) {
          previousValue = preRead.value;
        }
      } catch (e) {
        // 预读失败不阻断下发
      }
    }

    // 6. 执行安全写入与闭环回读校验
    const writeResult = await modbusClientManager.executeSafeWrite(
      gateway.id,
      gateway.ip,
      port,
      device.slaveId,
      point,
      value,
      timeout
    );

    // 7. 记录审计日志 (记录变更前原始值、本次下发值、回读值与完整网关IP:端口)
    const logData = {
      timestamp: new Date().toISOString(),
      operator,
      gatewayId: gateway.id,
      gatewayName: gateway.name,
      gatewayIp: `${gateway.ip}:${port}`,
      deviceId: device.id,
      deviceName: device.name,
      slaveId: device.slaveId,
      pointKey: point.key,
      pointName: point.name,
      functionCode: point.functionCode,
      address: point.address,
      previousValue,
      value,
      readbackValue: writeResult.readbackValue,
      executionTimeMs: writeResult.executionTimeMs,
      status: writeResult.success ? ('SUCCESS' as const) : ('FAILED' as const),
      errorMsg: writeResult.error
    };

    const auditLog = db.addAuditLog(logData);

    // 8. WebSocket 全局实时广播
    wsManager.broadcastAuditLog(auditLog);

    if (!writeResult.success) {
      return {
        success: false,
        message: writeResult.error || '控制下发失败',
        log: auditLog
      };
    }

    return {
      success: true,
      message: `控制指令下发成功，回读校验匹配 (${writeResult.executionTimeMs}ms)`,
      log: auditLog
    };
  }

  /**
   * 批量读取设备所有点位当前物理实时值
   */
  public async readDevicePoints(deviceId: string): Promise<Record<string, any>> {
    const device = db.getDeviceById(deviceId);
    if (!device) {
      throw new Error(`受控设备 [${deviceId}] 不存在`);
    }

    const gateway = db.getGatewayById(device.gatewayId);
    if (!gateway) {
      throw new Error(`设备所属网关 [${device.gatewayId}] 不存在`);
    }

    const template = db.getControlTemplateById(device.protocolTemplateId);
    if (!template) {
      throw new Error(`设备关联的协议模板 [${device.protocolTemplateId}] 不存在`);
    }

    const results: Record<string, any> = {};

    // 若所属网关已离线，直接返回离线状态，避免串行排队超时阻塞
    if (gateway.status === 'OFFLINE') {
      for (const point of template.points) {
        results[point.key] = {
          success: false,
          value: null,
          error: '所属网关当前处于离线状态'
        };
      }
      return results;
    }

    const port = gateway.port || 9502;
    const timeout = gateway.timeout || 2000;

    for (const point of template.points) {
      try {
        const readRes = await modbusClientManager.executeSafeRead(
          gateway.id,
          gateway.ip,
          port,
          device.slaveId,
          point,
          timeout
        );
        results[point.key] = {
          success: readRes.success,
          value: readRes.value,
          error: readRes.error
        };
      } catch (e: any) {
        results[point.key] = {
          success: false,
          value: null,
          error: e.message
        };
      }
    }

    return results;
  }

  /**
   * 探测单个受控从站设备的物理总线连通性
   */
  public async probeDevice(deviceId: string): Promise<{ success: boolean; status: 'ONLINE' | 'OFFLINE'; latencyMs?: number; message: string }> {
    const device = db.getDeviceById(deviceId);
    if (!device) {
      throw new Error(`受控设备 [${deviceId}] 不存在`);
    }

    const gateway = db.getGatewayById(device.gatewayId);
    if (!gateway) {
      throw new Error(`设备所属网关 [${device.gatewayId}] 不存在`);
    }

    if (gateway.status === 'OFFLINE') {
      device.status = 'OFFLINE';
      db.saveDevice(device);
      return {
        success: false,
        status: 'OFFLINE',
        message: `所属网关 [${gateway.name}] 当前处于离线状态`
      };
    }

    const template = db.getControlTemplateById(device.protocolTemplateId);
    // 取模板中的第 1 个点位，若无点位则构造默认 FC03 寄存器 0x0000 探活点
    const probePoint: ControlPoint = (template && template.points.length > 0)
      ? template.points[0]
      : {
          id: 'probe',
          name: '探活点',
          key: 'probe',
          functionCode: 3,
          address: 0,
          dataType: 'UINT16',
          registerCount: 1,
          permission: 'RO'
        };

    const port = gateway.port || 9502;
    const startTime = Date.now();
    try {
      const readRes = await modbusClientManager.executeSafeRead(
        gateway.id,
        gateway.ip,
        port,
        device.slaveId,
        probePoint,
        1200 // 探活单次超时 1.2 秒
      );
      const latencyMs = Date.now() - startTime;

      if (readRes.success) {
        device.status = 'ONLINE';
        db.saveDevice(device);
        return {
          success: true,
          status: 'ONLINE',
          latencyMs,
          message: `从站 #${device.slaveId} (${device.name}) 总线应答正常 (${latencyMs}ms)`
        };
      } else {
        device.status = 'OFFLINE';
        db.saveDevice(device);
        return {
          success: false,
          status: 'OFFLINE',
          message: `从站 #${device.slaveId} (${device.name}) 未响应: ${readRes.error || '超时'}`
        };
      }
    } catch (e: any) {
      device.status = 'OFFLINE';
      db.saveDevice(device);
      return {
        success: false,
        status: 'OFFLINE',
        message: `从站 #${device.slaveId} 探活异常: ${e.message}`
      };
    }
  }

  /**
   * 批量探测指定网关下挂的所有受控从站设备
   */
  public async probeGatewaySlaves(gatewayId: string): Promise<{
    gatewayId: string;
    total: number;
    onlineCount: number;
    offlineCount: number;
    results: Array<{ deviceId: string; slaveId: number; name: string; status: 'ONLINE' | 'OFFLINE'; message: string }>;
  }> {
    const allDevices = db.getDevices();
    const gwDevices = allDevices.filter(d => d.gatewayId === gatewayId);

    const results: Array<{ deviceId: string; slaveId: number; name: string; status: 'ONLINE' | 'OFFLINE'; message: string }> = [];
    let onlineCount = 0;
    let offlineCount = 0;

    for (const dev of gwDevices) {
      const probeRes = await this.probeDevice(dev.id);
      if (probeRes.status === 'ONLINE') {
        onlineCount++;
      } else {
        offlineCount++;
      }
      results.push({
        deviceId: dev.id,
        slaveId: dev.slaveId,
        name: dev.name,
        status: probeRes.status,
        message: probeRes.message
      });
    }

    return {
      gatewayId,
      total: gwDevices.length,
      onlineCount,
      offlineCount,
      results
    };
  }
}

export const controlService = new ControlService();
