import fs from 'fs';
import path from 'path';
import { 
  Gateway, 
  ControlledDevice, 
  ConnectionProtocol, 
  ControlProtocolTemplate, 
  User, 
  AuditLog 
} from '../domain/types';

interface DatabaseSchema {
  gateways: Gateway[];
  devices: ControlledDevice[];
  connectionProtocols: ConnectionProtocol[];
  controlTemplates: ControlProtocolTemplate[];
  users: User[];
  auditLogs: AuditLog[];
}

const DB_FILE = path.resolve(__dirname, '../../data/store.json');

const INITIAL_CLEAN_DATA: DatabaseSchema = {
  gateways: [],
  devices: [],
  connectionProtocols: [
    {
      id: 'conn-default-tcp',
      name: '标准 Modbus TCP 连接',
      type: 'MODBUS_TCP',
      port: 502,
      timeout: 2000,
      retryCount: 3,
      createdAt: new Date().toISOString()
    },
    {
      id: 'conn-default-rtu',
      name: 'Modbus RTU over TCP (9600 8-N-1)',
      type: 'MODBUS_RTU_OVER_TCP',
      port: 502,
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      timeout: 2000,
      retryCount: 3,
      createdAt: new Date().toISOString()
    }
  ],
  controlTemplates: [],
  users: [
    {
      id: 'usr-admin',
      username: 'admin',
      name: '系统管理员 (Admin)',
      role: 'ADMIN',
      allowedDeviceIds: [],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  ],
  auditLogs: []
};

class DatabaseService {
  private data: DatabaseSchema;
  private nextLogId: number;

  constructor() {
    this.ensureDataDir();
    this.data = this.load();
    this.nextLogId = (this.data.auditLogs.reduce((max, log) => Math.max(max, log.id), 0) || 0) + 1;
  }

  private ensureDataDir() {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load store.json, re-initializing clean data:', e);
    }
    this.save(INITIAL_CLEAN_DATA);
    return JSON.parse(JSON.stringify(INITIAL_CLEAN_DATA));
  }

  public resetToClean() {
    this.data = JSON.parse(JSON.stringify(INITIAL_CLEAN_DATA));
    this.save(this.data);
    this.nextLogId = 1;
  }

  private save(data: DatabaseSchema) {
    try {
      this.ensureDataDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save store.json:', e);
    }
  }

  private persist() {
    this.save(this.data);
  }

  // Gateways
  getGateways(): Gateway[] {
    return [...this.data.gateways];
  }

  getGatewayById(id: string): Gateway | undefined {
    return this.data.gateways.find(g => g.id === id);
  }

  saveGateway(gateway: Gateway): Gateway {
    const idx = this.data.gateways.findIndex(g => g.id === gateway.id);
    if (idx >= 0) {
      this.data.gateways[idx] = { ...gateway, updatedAt: new Date().toISOString() };
    } else {
      this.data.gateways.push({ ...gateway, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.persist();
    return gateway;
  }

  deleteGateway(id: string): boolean {
    const initialLen = this.data.gateways.length;
    this.data.gateways = this.data.gateways.filter(g => g.id !== id);
    this.data.devices = this.data.devices.filter(d => d.gatewayId !== id);
    this.persist();
    return this.data.gateways.length < initialLen;
  }

  // Devices
  getDevices(): ControlledDevice[] {
    return [...this.data.devices];
  }

  getDeviceById(id: string): ControlledDevice | undefined {
    return this.data.devices.find(d => d.id === id);
  }

  saveDevice(device: ControlledDevice): ControlledDevice {
    const idx = this.data.devices.findIndex(d => d.id === device.id);
    if (idx >= 0) {
      this.data.devices[idx] = { ...device, updatedAt: new Date().toISOString() };
    } else {
      this.data.devices.push({ ...device, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.persist();
    return device;
  }

  deleteDevice(id: string): boolean {
    const initialLen = this.data.devices.length;
    this.data.devices = this.data.devices.filter(d => d.id !== id);
    this.persist();
    return this.data.devices.length < initialLen;
  }

  // Connection Protocols
  getConnectionProtocols(): ConnectionProtocol[] {
    return [...this.data.connectionProtocols];
  }

  saveConnectionProtocol(protocol: ConnectionProtocol): ConnectionProtocol {
    const idx = this.data.connectionProtocols.findIndex(p => p.id === protocol.id);
    if (idx >= 0) {
      this.data.connectionProtocols[idx] = protocol;
    } else {
      this.data.connectionProtocols.push(protocol);
    }
    this.persist();
    return protocol;
  }

  deleteConnectionProtocol(id: string): boolean {
    const initialLen = this.data.connectionProtocols.length;
    this.data.connectionProtocols = this.data.connectionProtocols.filter(p => p.id !== id);
    this.persist();
    return this.data.connectionProtocols.length < initialLen;
  }

  // Control Protocol Templates
  getControlTemplates(): ControlProtocolTemplate[] {
    return [...this.data.controlTemplates];
  }

  getControlTemplateById(id: string): ControlProtocolTemplate | undefined {
    return this.data.controlTemplates.find(t => t.id === id);
  }

  saveControlTemplate(template: ControlProtocolTemplate): ControlProtocolTemplate {
    const idx = this.data.controlTemplates.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      this.data.controlTemplates[idx] = { ...template, updatedAt: new Date().toISOString() };
    } else {
      this.data.controlTemplates.push({ ...template, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.persist();
    return template;
  }

  deleteControlTemplate(id: string): boolean {
    const initialLen = this.data.controlTemplates.length;
    this.data.controlTemplates = this.data.controlTemplates.filter(t => t.id !== id);
    this.persist();
    return this.data.controlTemplates.length < initialLen;
  }

  // Users
  getUsers(): User[] {
    return [...this.data.users];
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  getUserByUsername(username: string): User | undefined {
    return this.data.users.find(u => u.username === username);
  }

  getUserByFeishuId(feishuUserId?: string, feishuOpenId?: string): User | undefined {
    if (!feishuUserId && !feishuOpenId) return undefined;
    return this.data.users.find(u => 
      (feishuUserId && u.feishuUserId === feishuUserId) ||
      (feishuOpenId && u.feishuOpenId === feishuOpenId)
    );
  }

  saveUser(user: User): User {
    const idx = this.data.users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      this.data.users[idx] = user;
    } else {
      this.data.users.push(user);
    }
    this.persist();
    return user;
  }

  deleteUser(id: string): boolean {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter(u => u.id !== id);
    this.persist();
    return this.data.users.length < initialLen;
  }

  // Audit Logs
  getAuditLogs(limit = 100): AuditLog[] {
    return this.data.auditLogs.slice(-limit).reverse();
  }

  addAuditLog(log: Omit<AuditLog, 'id'>): AuditLog {
    const newLog: AuditLog = {
      id: this.nextLogId++,
      ...log
    };
    this.data.auditLogs.push(newLog);
    if (this.data.auditLogs.length > 2000) {
      this.data.auditLogs = this.data.auditLogs.slice(-2000);
    }
    this.persist();
    return newLog;
  }

  clearAuditLogs(): void {
    this.data.auditLogs = [];
    this.persist();
  }

  // =======================
  // 系统全量配置备份与恢复
  // =======================
  exportBackup(): { version: string; system: string; exportedAt: string; data: DatabaseSchema } {
    return {
      version: '1.0.0',
      system: 'AnyControl Industrial Control Platform',
      exportedAt: new Date().toISOString(),
      data: JSON.parse(JSON.stringify(this.data))
    };
  }

  importBackup(backupPayload: any, mode: 'OVERWRITE' | 'MERGE' = 'OVERWRITE'): {
    gatewaysCount: number;
    devicesCount: number;
    templatesCount: number;
    usersCount: number;
    logsCount: number;
  } {
    const rawData = backupPayload.data || backupPayload;

    const importedGateways: Gateway[] = Array.isArray(rawData.gateways) ? rawData.gateways : [];
    const importedDevices: ControlledDevice[] = Array.isArray(rawData.devices) ? rawData.devices : [];
    const importedTemplates: ControlProtocolTemplate[] = Array.isArray(rawData.controlTemplates) 
      ? rawData.controlTemplates 
      : (Array.isArray(rawData.templates) ? rawData.templates : []);
    const importedUsers: User[] = Array.isArray(rawData.users) ? rawData.users : [];
    const importedLogs: AuditLog[] = Array.isArray(rawData.auditLogs) 
      ? rawData.auditLogs 
      : (Array.isArray(rawData.logs) ? rawData.logs : []);

    if (mode === 'OVERWRITE') {
      this.data.gateways = importedGateways;
      this.data.devices = importedDevices;
      this.data.controlTemplates = importedTemplates;
      this.data.users = importedUsers.length > 0 ? importedUsers : INITIAL_CLEAN_DATA.users;
      this.data.auditLogs = importedLogs;
    } else {
      // MERGE MODE
      for (const gw of importedGateways) {
        const idx = this.data.gateways.findIndex(g => g.id === gw.id);
        if (idx >= 0) this.data.gateways[idx] = gw;
        else this.data.gateways.push(gw);
      }
      for (const dev of importedDevices) {
        const idx = this.data.devices.findIndex(d => d.id === dev.id);
        if (idx >= 0) this.data.devices[idx] = dev;
        else this.data.devices.push(dev);
      }
      for (const tpl of importedTemplates) {
        const idx = this.data.controlTemplates.findIndex(t => t.id === tpl.id);
        if (idx >= 0) this.data.controlTemplates[idx] = tpl;
        else this.data.controlTemplates.push(tpl);
      }
      for (const u of importedUsers) {
        const idx = this.data.users.findIndex(existing => existing.id === u.id || existing.username === u.username);
        if (idx >= 0) this.data.users[idx] = u;
        else this.data.users.push(u);
      }
      for (const log of importedLogs) {
        if (!this.data.auditLogs.some(existing => existing.id === log.id && existing.timestamp === log.timestamp)) {
          this.data.auditLogs.push(log);
        }
      }
    }

    this.nextLogId = (this.data.auditLogs.reduce((max, log) => Math.max(max, log.id), 0) || 0) + 1;
    this.persist();

    return {
      gatewaysCount: this.data.gateways.length,
      devicesCount: this.data.devices.length,
      templatesCount: this.data.controlTemplates.length,
      usersCount: this.data.users.length,
      logsCount: this.data.auditLogs.length
    };
  }
}

export const db = new DatabaseService();
