import ModbusRTU from "modbus-serial";
import PQueue from "p-queue";
import { ControlPoint, DataType, ByteOrder } from "../domain/types";

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

// ──────────────────────────────────────────────────────
// 32 位数据编解码工具 (修复 W2: FC16 多寄存器写入)
// ──────────────────────────────────────────────────────

/**
 * 将数值编码为 Modbus 16 位 word 数组（支持 UINT32 / INT32 / FLOAT32）
 */
function encodeToWords(value: number, dataType: DataType, byteOrder?: ByteOrder): number[] {
  if (dataType === "UINT32" || dataType === "INT32" || dataType === "FLOAT32") {
    const buf = Buffer.alloc(4);
    if (dataType === "FLOAT32") {
      buf.writeFloatBE(value, 0);
    } else if (dataType === "INT32") {
      buf.writeInt32BE(value, 0);
    } else {
      buf.writeUInt32BE(value >>> 0, 0);
    }
    return applyByteOrderEncode(buf, byteOrder || "ABCD");
  }
  return [value & 0xffff];
}

function applyByteOrderEncode(buf: Buffer, order: ByteOrder): number[] {
  switch (order) {
    case "ABCD":
      return [(buf[0] << 8) | buf[1], (buf[2] << 8) | buf[3]];
    case "CDAB":
      return [(buf[2] << 8) | buf[3], (buf[0] << 8) | buf[1]];
    case "BADC":
      return [(buf[1] << 8) | buf[0], (buf[3] << 8) | buf[2]];
    case "DCBA":
      return [(buf[3] << 8) | buf[2], (buf[1] << 8) | buf[0]];
    default:
      return [(buf[0] << 8) | buf[1], (buf[2] << 8) | buf[3]];
  }
}

function decodeFromWords(words: number[], dataType: DataType, byteOrder?: ByteOrder): number {
  if (words.length < 2 || (dataType !== "UINT32" && dataType !== "INT32" && dataType !== "FLOAT32")) {
    return words[0] ?? 0;
  }
  const buf = Buffer.alloc(4);
  const order = byteOrder || "ABCD";
  switch (order) {
    case "ABCD":
      buf[0] = (words[0] >> 8) & 0xff; buf[1] = words[0] & 0xff;
      buf[2] = (words[1] >> 8) & 0xff; buf[3] = words[1] & 0xff;
      break;
    case "CDAB":
      buf[2] = (words[0] >> 8) & 0xff; buf[3] = words[0] & 0xff;
      buf[0] = (words[1] >> 8) & 0xff; buf[1] = words[1] & 0xff;
      break;
    case "BADC":
      buf[1] = (words[0] >> 8) & 0xff; buf[0] = words[0] & 0xff;
      buf[3] = (words[1] >> 8) & 0xff; buf[2] = words[1] & 0xff;
      break;
    case "DCBA":
      buf[3] = (words[0] >> 8) & 0xff; buf[2] = words[0] & 0xff;
      buf[1] = (words[1] >> 8) & 0xff; buf[0] = words[1] & 0xff;
      break;
  }
  if (dataType === "FLOAT32") return buf.readFloatBE(0);
  if (dataType === "INT32") return buf.readInt32BE(0);
  return buf.readUInt32BE(0);
}

// ──────────────────────────────────────────────────────

class ModbusClientManager {
  private clients: Map<string, ModbusRTU> = new Map();
  private queues: Map<string, PQueue> = new Map();

  private getQueue(gatewayId: string): PQueue {
    let queue = this.queues.get(gatewayId);
    if (!queue) {
      queue = new PQueue({ concurrency: 1 });
      this.queues.set(gatewayId, queue);
    }
    return queue;
  }

  private async getClient(gatewayId: string, ip: string, port: number, timeout = 2000): Promise<ModbusRTU> {
    const key = `${gatewayId}:${ip}:${port}`;
    let client = this.clients.get(key);

    if (!client || !client.isOpen) {
      // W1 修复：若旧连接存在但已不可用，先主动关闭并清除缓存
      if (client) {
        try { client.close(() => {}); } catch (_) {}
        this.clients.delete(key);
      }
      client = new ModbusRTU();
      client.setTimeout(timeout);
      try {
        await client.connectTCP(ip, { port });
        console.log(`[Modbus Client] 成功连接网关 ${gatewayId} -> ${ip}:${port}`);
        this.clients.set(key, client);
      } catch (err: any) {
        this.clients.delete(key);
        console.error(`[Modbus Client] 连接网关 ${gatewayId} (${ip}:${port}) 失败:`, err.message);
        throw new Error(`无法连接到网关 [${ip}:${port}]: ${err.message}`);
      }
    }
    return client;
  }

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
    const key = `${gatewayId}:${ip}:${port}`;

    return queue.add(async () => {
      const startTime = Date.now();
      let client: ModbusRTU;
      try {
        client = await this.getClient(gatewayId, ip, port, timeout);
      } catch (err: any) {
        return { success: false, value: targetValue, readbackValue: null, executionTimeMs: Date.now() - startTime, error: err.message };
      }
      client.setID(slaveId);

      const scale = point.scale || 1;
      let rawWriteVal: number | boolean = targetValue;
      if (point.dataType !== "BOOLEAN" && typeof targetValue === "number") {
        rawWriteVal = Math.round(targetValue / scale);
      }

      try {
        if (point.functionCode === 5 || point.dataType === "BOOLEAN") {
          const boolVal = Boolean(targetValue);
          await client.writeCoil(point.address, boolVal);

          if (point.permission !== "WO") {
            const readRes = await client.readCoils(point.address, 1);
            const readback = readRes.data ? Boolean(readRes.data[0]) : null;
            if (readback !== boolVal) {
              throw new Error(`闭环物理校验失败: 期望线圈状态 [${boolVal}], 实际回读 [${readback}]`);
            }
            return { success: true, value: boolVal, readbackValue: readback, executionTimeMs: Date.now() - startTime };
          } else {
            return { success: true, value: boolVal, readbackValue: boolVal, executionTimeMs: Date.now() - startTime };
          }
        } else {
          const numVal = Number(rawWriteVal);
          const registerCount = point.registerCount || 1;

          if (registerCount > 1 || point.functionCode === 16) {
            // W2 修复：按数据类型和字节序正确编码为多个 word 后写入
            const words = encodeToWords(numVal, point.dataType, point.byteOrder);
            await client.writeRegisters(point.address, words);
          } else {
            await client.writeRegister(point.address, numVal);
          }

          if (point.permission !== "WO") {
            // W2 修复：按 registerCount 回读正确数量的寄存器
            const readRes = await client.readHoldingRegisters(point.address, registerCount);
            if (!readRes.data || readRes.data.length === 0) {
              throw new Error(`闭环物理校验失败: 未能从寄存器 ${point.address} 回读数据`);
            }

            // W2 修复：多寄存器时用 decodeFromWords 还原实际值
            const rawActual = registerCount > 1
              ? decodeFromWords(Array.from(readRes.data), point.dataType, point.byteOrder)
              : readRes.data[0];
            const actualVal = rawActual * scale;

            // W3 修复：分步判断容差，去掉错误的 && 短路逻辑
            const tolerance = Math.max(scale * 0.5, 0.001);
            const diff = Math.abs(actualVal - Number(targetValue));
            if (diff > tolerance) {
              throw new Error(`闭环物理校验不匹配: 期望值 [${targetValue}], 实际回读 [${actualVal}] (容差 ±${tolerance})`);
            }

            return { success: true, value: targetValue, readbackValue: actualVal, executionTimeMs: Date.now() - startTime };
          } else {
            return { success: true, value: targetValue, readbackValue: targetValue, executionTimeMs: Date.now() - startTime };
          }
        }
      } catch (err: any) {
        // W1 修复：操作失败时主动断开连接，下次强制重建
        try { const c = this.clients.get(key); if (c) { c.close(() => {}); } } catch (_) {}
        this.clients.delete(key);
        return {
          success: false,
          value: targetValue,
          readbackValue: null,
          executionTimeMs: Date.now() - startTime,
          error: err.message || "Modbus 操作异常"
        };
      }
    }) as Promise<WriteResult>;
  }

  public async executeSafeRead(
    gatewayId: string,
    ip: string,
    port: number,
    slaveId: number,
    point: ControlPoint,
    timeout = 2000
  ): Promise<ReadResult> {
    const queue = this.getQueue(gatewayId);
    const key = `${gatewayId}:${ip}:${port}`;

    return queue.add(async () => {
      let client: ModbusRTU;
      try {
        client = await this.getClient(gatewayId, ip, port, timeout);
      } catch (err: any) {
        return { success: false, value: null, error: err.message };
      }
      client.setID(slaveId);
      const scale = point.scale || 1;
      const registerCount = point.registerCount || 1;

      try {
        if (point.dataType === "BOOLEAN" || point.functionCode === 1 || point.functionCode === 5) {
          const res = await client.readCoils(point.address, 1);
          return { success: true, value: res.data ? Boolean(res.data[0]) : null };
        } else if (point.functionCode === 2) {
          const res = await client.readDiscreteInputs(point.address, 1);
          return { success: true, value: res.data ? Boolean(res.data[0]) : null };
        } else if (point.functionCode === 4) {
          const res = await client.readInputRegisters(point.address, registerCount);
          if (!res.data) return { success: true, value: null };
          const raw = registerCount > 1
            ? decodeFromWords(Array.from(res.data), point.dataType, point.byteOrder)
            : res.data[0];
          return { success: true, value: raw * scale };
        } else {
          const res = await client.readHoldingRegisters(point.address, registerCount);
          if (!res.data) return { success: true, value: null };
          const raw = registerCount > 1
            ? decodeFromWords(Array.from(res.data), point.dataType, point.byteOrder)
            : res.data[0];
          return { success: true, value: raw * scale };
        }
      } catch (err: any) {
        // W1 修复：读取失败时主动断开连接
        try { const c = this.clients.get(key); if (c) { c.close(() => {}); } } catch (_) {}
        this.clients.delete(key);
        return { success: false, value: null, error: err.message };
      }
    }) as Promise<ReadResult>;
  }

  public async testGatewayConnection(ip: string, port: number, timeout = 2000): Promise<{ online: boolean; message: string }> {
    const testClient = new ModbusRTU();
    testClient.setTimeout(timeout);
    try {
      await testClient.connectTCP(ip, { port });
      testClient.close(() => {});
      return { online: true, message: "网关 TCP 端口通讯正常" };
    } catch (e: any) {
      return { online: false, message: e.message || "连接超时或网络不可达" };
    }
  }
}

export const modbusClientManager = new ModbusClientManager();
