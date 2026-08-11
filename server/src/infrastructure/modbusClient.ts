import ModbusRTU from 'modbus-serial';
import PQueue from 'p-queue';
import { ControlPoint } from '../domain/types';

export interface WriteResult {
  success: boolean;
  value: number | boolean;
  readbackValue: number | boolean | null;
  executionTimeMs: number;
  error?: string;
}

export interface ReadResult {
  success: boolean;
  value: number | boolean | null;
  error?: string;
}

class ModbusClientManager {
  private clients: Map<string, ModbusRTU> = new Map();
  private queues: Map<string, PQueue> = new Map();

  private getQueue(gatewayId: string): PQueue {
    let queue = this.queues.get(gatewayId);
    if (!queue) {
      // 关键工业级防护：总线串行排队器，并发度严格为 1
      queue = new PQueue({ concurrency: 1 });
      this.queues.set(gatewayId, queue);
    }
    return queue;
  }

  private async getClient(gatewayId: string, ip: string, port: number, timeout = 2000): Promise<ModbusRTU> {
    const key = `${gatewayId}:${ip}:${port}`;
    let client = this.clients.get(key);

    if (!client || !client.isOpen) {
      client = new ModbusRTU();
      client.setTimeout(timeout);
      try {
        await client.connectTCP(ip, { port });
        console.log(`[Modbus Client] 成功连接网关 ${gatewayId} -> ${ip}:${port}`);
        this.clients.set(key, client);
      } catch (err: any) {
        console.error(`[Modbus Client] 连接网关 ${gatewayId} (${ip}:${port}) 失败:`, err.message);
        throw new Error(`无法连接到网关 [${ip}:${port}]: ${err.message}`);
      }
    }
    return client;
  }

  /**
   * 闭环安全写入 (Safe Write with Closed-Loop Readback Verification)
   */
  public async executeSafeWrite(
    gatewayId: string,
    ip: string,
    port: number,
    slaveId: number,
    point: ControlPoint,
    targetValue: number | boolean,
    timeout = 2000
  ): Promise<WriteResult> {
    const queue = this.getQueue(gatewayId);

    return queue.add(async () => {
      const startTime = Date.now();
      const client = await this.getClient(gatewayId, ip, port, timeout);
      client.setID(slaveId);

      const scale = point.scale || 1;
      let rawWriteVal: number | boolean = targetValue;
      
      if (point.dataType !== 'BOOLEAN' && typeof targetValue === 'number') {
        // 根据 scale 计算原生整数寄存器值
        rawWriteVal = Math.round(targetValue / scale);
      }

      try {
        // 1. 根据功能码执行写入
        if (point.functionCode === 5 || point.dataType === 'BOOLEAN') {
          // 写入单个线圈
          const boolVal = Boolean(targetValue);
          await client.writeCoil(point.address, boolVal);

          // 2. 闭环校验：只写点位(WO)跳过回读，读写(RW)执行 0x01 回读校验
          if (point.permission !== 'WO') {
            const readRes = await client.readCoils(point.address, 1);
            const readback = readRes.data ? readRes.data[0] : null;

            if (readback !== boolVal) {
              throw new Error(`闭环物理校验失败: 期望线圈状态 [${boolVal}], 实际回读 [${readback}]`);
            }

            const executionTimeMs = Date.now() - startTime;
            return {
              success: true,
              value: boolVal,
              readbackValue: readback,
              executionTimeMs
            };
          } else {
            const executionTimeMs = Date.now() - startTime;
            return {
              success: true,
              value: boolVal,
              readbackValue: boolVal,
              executionTimeMs
            };
          }
        } else {
          // 保持寄存器写入 (FC 06 / FC 16)
          const numVal = Number(rawWriteVal);
          if (point.functionCode === 16 || point.registerCount > 1) {
            // 写入多个寄存器
            await client.writeRegisters(point.address, [numVal]);
          } else {
            // FC 06 写入单个保持寄存器
            await client.writeRegister(point.address, numVal);
          }

          // 2. 闭环校验：执行 0x03 回读校验
          if (point.permission !== 'WO') {
            const readRes = await client.readHoldingRegisters(point.address, 1);
            if (!readRes.data || readRes.data.length === 0) {
              throw new Error(`闭环物理校验失败: 未能从寄存器 ${point.address} 回读数据`);
            }

            const rawReadback = readRes.data[0];
            const actualVal = rawReadback * scale;

            // 浮点数/倍率校验容差
            const diff = Math.abs(Number(actualVal) - Number(targetValue));
            if (diff > (scale * 0.5 || 0.001) && rawReadback !== numVal) {
              throw new Error(`闭环物理校验不匹配: 期望值 [${targetValue}], 实际回读 [${actualVal}] (Raw: ${rawReadback})`);
            }

            const executionTimeMs = Date.now() - startTime;
            return {
              success: true,
              value: targetValue,
              readbackValue: actualVal,
              executionTimeMs
            };
          } else {
            const executionTimeMs = Date.now() - startTime;
            return {
              success: true,
              value: targetValue,
              readbackValue: targetValue,
              executionTimeMs
            };
          }
        }
      } catch (err: any) {
        const executionTimeMs = Date.now() - startTime;
        return {
          success: false,
          value: targetValue,
          readbackValue: null,
          executionTimeMs,
          error: err.message || 'Modbus 操作异常'
        };
      }
    });
  }

  /**
   * 安全读取点位物理值
   */
  public async executeSafeRead(
    gatewayId: string,
    ip: string,
    port: number,
    slaveId: number,
    point: ControlPoint,
    timeout = 2000
  ): Promise<ReadResult> {
    const queue = this.getQueue(gatewayId);

    return queue.add(async () => {
      try {
        const client = await this.getClient(gatewayId, ip, port, timeout);
        client.setID(slaveId);
        const scale = point.scale || 1;

        if (point.dataType === 'BOOLEAN' || point.functionCode === 1 || point.functionCode === 5) {
          const res = await client.readCoils(point.address, 1);
          return {
            success: true,
            value: res.data ? res.data[0] : null
          };
        } else if (point.functionCode === 2) {
          const res = await client.readDiscreteInputs(point.address, 1);
          return {
            success: true,
            value: res.data ? res.data[0] : null
          };
        } else if (point.functionCode === 4) {
          const res = await client.readInputRegisters(point.address, point.registerCount || 1);
          const raw = res.data ? res.data[0] : 0;
          return {
            success: true,
            value: raw * scale
          };
        } else {
          // 默认 FC 03 Read Holding Registers
          const res = await client.readHoldingRegisters(point.address, point.registerCount || 1);
          const raw = res.data ? res.data[0] : 0;
          return {
            success: true,
            value: raw * scale
          };
        }
      } catch (err: any) {
        return {
          success: false,
          value: null,
          error: err.message
        };
      }
    });
  }

  /**
   * 探测网关连接性
   */
  public async testGatewayConnection(ip: string, port: number, timeout = 2000): Promise<{ online: boolean; message: string }> {
    const testClient = new ModbusRTU();
    testClient.setTimeout(timeout);
    try {
      await testClient.connectTCP(ip, { port });
      testClient.close(() => {});
      return { online: true, message: '网关 TCP 端口通讯正常' };
    } catch (e: any) {
      return { online: false, message: e.message || '连接超时或网络不可达' };
    }
  }
}

export const modbusClientManager = new ModbusClientManager();
