import { db } from '../infrastructure/db';
import { modbusClientManager } from '../infrastructure/modbusClient';
import { wsManager } from '../infrastructure/wsServer';
import { ControlCommandRequest, AuditLog } from '../domain/types';

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
}

export const controlService = new ControlService();
