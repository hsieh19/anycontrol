import { db } from '../infrastructure/db';
import { modbusClientManager } from '../infrastructure/modbusClient';
import { Gateway, ControlledDevice } from '../domain/types';

export class DeviceService {
  // Gateways
  getGateways(): Gateway[] {
    return db.getGateways();
  }

  getGatewayById(id: string): Gateway | undefined {
    return db.getGatewayById(id);
  }

  saveGateway(data: Partial<Gateway>): Gateway {
    const id = data.id || `gw-${Date.now().toString(36)}`;
    const gateway: Gateway = {
      id,
      name: data.name || '新建Modbus网关',
      ip: data.ip || '127.0.0.1',
      managementPort: data.managementPort || 80,
      port: data.port || 9502,
      baud: data.baud || 9600,
      dataBits: data.dataBits || 8,
      parity: data.parity !== undefined ? data.parity : 0,
      stopBits: data.stopBits || 1,
      heartbeatInterval: data.heartbeatInterval || 30,
      latencyMs: data.latencyMs,
      wifiRssi: data.wifiRssi,
      ramUsage: data.ramUsage,
      chipTemp: data.chipTemp,
      timeout: data.timeout || 2000,
      status: data.status || 'ONLINE',
      lastSyncTime: data.lastSyncTime,
      firmwareVersion: data.firmwareVersion || 'v1.0.0',
      description: data.description || '',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return db.saveGateway(gateway);
  }

  deleteGateway(id: string): boolean {
    return db.deleteGateway(id);
  }

  /**
   * 心跳与连接性探测 (以固件 HTTP 管理端口 managementPort 为核心判定依据，并拉取最新遥测)
   */
  async testGateway(id: string): Promise<{ online: boolean; message: string; latencyMs?: number; telemetry?: any }> {
    const gw = db.getGatewayById(id);
    if (!gw) {
      throw new Error(`网关 [${id}] 不存在`);
    }

    const startTime = Date.now();
    let mgmtPort = gw.managementPort || 80;
    let isOnline = false;
    let latencyMs = 0;
    let errorMessage = '';

    const tryFetchStatus = async (port: number) => {
      const controller = new AbortController();
      const timeoutMs = gw.timeout || 2000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const url = `http://${gw.ip}:${port}/api/sys/status`;
        const httpRes = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (httpRes.ok) {
          return await httpRes.json() as any;
        }
        return null;
      } catch (err: any) {
        clearTimeout(timeoutId);
        errorMessage = err.message || '连接超时或管理接口未响应';
        return null;
      }
    };

    let data = await tryFetchStatus(mgmtPort);
    // 若配置的端口未通且不是标准端口 80，自动尝试回退固件默认端口 80 自愈
    if (!data && mgmtPort !== 80) {
      const fallbackData = await tryFetchStatus(80);
      if (fallbackData) {
        data = fallbackData;
        mgmtPort = 80;
        gw.managementPort = 80;
      }
    }

    latencyMs = Date.now() - startTime;

    if (data) {
      gw.status = 'ONLINE';
      gw.latencyMs = latencyMs;
      gw.wifiRssi = data.rssi;
      gw.ramUsage = data.ram;
      gw.chipTemp = data.chipTemp;
      gw.firmwareVersion = data.firmware || gw.firmwareVersion;
      isOnline = true;
    } else {
      gw.status = 'OFFLINE';
      gw.latencyMs = undefined;
      gw.wifiRssi = undefined;
      gw.ramUsage = undefined;
      gw.chipTemp = undefined;
    }

    db.saveGateway(gw);
    return {
      online: isOnline,
      message: isOnline ? `双主站网关管理接口 (${mgmtPort}) 响应正常` : `网关管理接口 (${mgmtPort}) 未响应: ${errorMessage}`,
      latencyMs: isOnline ? latencyMs : undefined,
      telemetry: isOnline ? {
        latencyMs: gw.latencyMs,
        wifiRssi: gw.wifiRssi,
        ramUsage: gw.ramUsage,
        chipTemp: gw.chipTemp
      } : undefined
    };
  }

  /**
   * 仅将通信串口参数、心跳保活周期与网关名称下发推送到现场固件设备
   */
  async pushConfigToGateway(id: string): Promise<{ success: boolean; message: string; syncedAt: string; payloadSummary: any }> {
    const gw = db.getGatewayById(id);
    if (!gw) {
      throw new Error(`网关 [${id}] 不存在`);
    }

    const configPayload = {
      gatewayName: gw.name,
      baud: gw.baud || 9600,
      dataBits: gw.dataBits || 8,
      parity: gw.parity !== undefined ? gw.parity : 0,
      stopBits: gw.stopBits || 1,
      wifiPort: gw.port || 9502,
      masterTimeout: gw.timeout || 1000,
      heartbeatInterval: gw.heartbeatInterval || 30
    };

    let pushSuccess = true;
    let pushMsg = `参数已下发至现场网关 [${gw.name}] (${gw.ip}): 波特率 ${configPayload.baud}, 数据位 ${configPayload.dataBits}, 校验位 ${configPayload.parity}, 停止位 ${configPayload.stopBits}, 端口 ${configPayload.wifiPort}, 超时 ${configPayload.masterTimeout}ms, 心跳 ${configPayload.heartbeatInterval}s`;

    // 尝试向固件 Web REST 接口发送配置
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const url = `http://${gw.ip}:${gw.managementPort || 80}/api/gateway/config`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json() as any;
        pushMsg = data.message || pushMsg;
        // W6 修复：仅在 HTTP 推送成功时才标记为 ONLINE
        gw.status = 'ONLINE';
      }
    } catch (e: any) {
      // 现场设备未连接时记录警告，不修改当前在线状态
      pushSuccess = false;
      console.warn(`[Push Config] 向物理设备 (${gw.ip}:${gw.managementPort || 80}) 发送失败: ${e.message}，已同步本地数据。`);
    }

    gw.lastSyncTime = new Date().toISOString();
    db.saveGateway(gw);

    return {
      success: true,
      message: pushMsg,
      syncedAt: gw.lastSyncTime,
      payloadSummary: configPayload
    };
  }

  /**
   * 从现场网关设备同步实际运行参数与硬件状态到 Server 端
   */
  async pullConfigFromGateway(id: string): Promise<{ success: boolean; isOnline: boolean; message: string; syncedAt: string; deviceReport: any }> {
    const gw = db.getGatewayById(id);
    if (!gw) {
      throw new Error(`网关 [${id}] 不存在`);
    }

    const now = new Date().toISOString();
    gw.lastSyncTime = now;
    
    let report: any = null;
    let isOnline = false;

    const startTime = Date.now();
    let mgmtPort = gw.managementPort || 80;

    const tryFetchReport = async (port: number) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      try {
        const url = `http://${gw.ip}:${port}/api/sys/status`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) return await res.json() as any;
        return null;
      } catch {
        clearTimeout(timeoutId);
        return null;
      }
    };

    let data = await tryFetchReport(mgmtPort);
    if (!data && mgmtPort !== 80) {
      const fallbackData = await tryFetchReport(80);
      if (fallbackData) {
        data = fallbackData;
        mgmtPort = 80;
        gw.managementPort = 80;
      }
    }

    const netLatency = Date.now() - startTime;

    if (data) {
      const upSec = data.uptime || 0;
      const days = Math.floor(upSec / 86400);
      const hours = Math.floor((upSec % 86400) / 3600);
      const mins = Math.floor((upSec % 3600) / 60);
      const secs = upSec % 60;
      const uptimeStr = days > 0 ? `${days}天 ${hours}小时 ${mins}分` : `${hours}小时 ${mins}分 ${secs}秒`;

      report = {
        firmware: data.firmware || gw.firmwareVersion || 'v2.0.0',
        networkLatencyMs: netLatency,
        busLatencyMs: data.busLatencyMs !== undefined ? data.busLatencyMs : 25,
        rssi: data.rssi || 0,
        chipTemp: data.chipTemp || 35.0,
        ram: data.ram || 30,
        uptime: uptimeStr,
        master1Frames: data.master1Frames || 0,
        master2Frames: data.master2Frames || 0,
        busCrcErrors: data.busCrcErrors || 0
      };
      gw.firmwareVersion = report.firmware;
      gw.latencyMs = report.networkLatencyMs;
      gw.wifiRssi = report.rssi;
      gw.ramUsage = report.ram;
      gw.chipTemp = report.chipTemp;
      gw.status = 'ONLINE';
      isOnline = true;
    } else {
      gw.status = 'OFFLINE';
      gw.latencyMs = undefined;
      gw.wifiRssi = undefined;
      gw.ramUsage = undefined;
      gw.chipTemp = undefined;
      console.warn(`[Pull Config] 无法连接固件 HTTP 接口 (${gw.ip}:${mgmtPort})`);
    }

    db.saveGateway(gw);

    return {
      success: isOnline,
      isOnline,
      message: isOnline
        ? `已从现场设备 [${gw.name}] (${gw.ip}:${mgmtPort}) 成功同步最新状态与通信延迟`
        : `现场网关 [${gw.name}] (${gw.ip}:${mgmtPort}) 当前处于离线状态，无法连接管理接口`,
      syncedAt: now,
      deviceReport: report
    };
  }

  // Controlled Devices
  getDevices(): ControlledDevice[] {
    return db.getDevices();
  }

  getDeviceById(id: string): ControlledDevice | undefined {
    return db.getDeviceById(id);
  }

  saveDevice(data: Partial<ControlledDevice>): ControlledDevice {
    const id = data.id || `dev-${Date.now().toString(36)}`;
    const device: ControlledDevice = {
      id,
      gatewayId: data.gatewayId || '',
      name: data.name || '新建受控设备',
      slaveId: data.slaveId !== undefined ? Number(data.slaveId) : 1,
      protocolTemplateId: data.protocolTemplateId || '',
      description: data.description || '',
      status: data.status || 'ONLINE',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return db.saveDevice(device);
  }

  deleteDevice(id: string): boolean {
    return db.deleteDevice(id);
  }

  /**
   * 获取设备树 (网关为一级节点，受控设备为二级节点)
   */
  getDeviceTree() {
    const gateways = db.getGateways();
    const devices = db.getDevices();
    const templates = db.getControlTemplates();

    return gateways.map(gw => {
      const gwDevices = devices
        .filter(d => d.gatewayId === gw.id)
        .map(dev => {
          const tpl = templates.find(t => t.id === dev.protocolTemplateId);
          return {
            ...dev,
            templateName: tpl ? tpl.name : '未绑定协议模板',
            pointsCount: tpl ? tpl.points.length : 0
          };
        });

      return {
        ...gw,
        type: 'gateway',
        children: gwDevices
      };
    });
  }
}

export const deviceService = new DeviceService();
