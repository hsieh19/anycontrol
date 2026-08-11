import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import {
  Gateway,
  ControlledDevice,
  ConnectionProtocol,
  ControlProtocolTemplate,
  User,
  AuditLog,
} from "../domain/types";

const DATA_DIR = path.resolve(__dirname, "../../data");
const DB_FILE = path.join(DATA_DIR, "anycontrol.db");
const LEGACY_JSON_FILE = path.join(DATA_DIR, "store.json");

const INITIAL_DEFAULT_PROTOCOLS: ConnectionProtocol[] = [
  {
    id: "conn-default-tcp",
    name: "标准 Modbus TCP 连接",
    type: "MODBUS_TCP",
    port: 502,
    timeout: 2000,
    retryCount: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: "conn-default-rtu",
    name: "Modbus RTU over TCP (9600 8-N-1)",
    type: "MODBUS_RTU_OVER_TCP",
    port: 502,
    baudRate: 9600,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    timeout: 2000,
    retryCount: 3,
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_DEFAULT_ADMIN: User = {
  id: "usr-admin",
  username: "admin",
  name: "系统管理员 (Admin)",
  role: "ADMIN",
  allowedDeviceIds: [],
  status: "ACTIVE",
  createdAt: new Date().toISOString(),
};

class SQLiteDatabaseService {
  private db: Database.Database;

  constructor() {
    this.ensureDataDir();
    this.db = new Database(DB_FILE);
    // 启用 WAL 模式提高并发读写性能
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    this.initTables();
    this.checkAndMigrateLegacyData();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gateways (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ip TEXT NOT NULL,
        managementPort INTEGER NOT NULL DEFAULT 80,
        port INTEGER DEFAULT 9502,
        baud INTEGER DEFAULT 9600,
        dataBits INTEGER DEFAULT 8,
        parity INTEGER DEFAULT 0,
        stopBits INTEGER DEFAULT 1,
        heartbeatInterval INTEGER DEFAULT 30,
        latencyMs REAL,
        wifiRssi INTEGER,
        ramUsage INTEGER,
        chipTemp REAL,
        timeout INTEGER DEFAULT 2000,
        status TEXT NOT NULL DEFAULT 'UNKNOWN',
        lastSyncTime TEXT,
        firmwareVersion TEXT,
        description TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        gatewayId TEXT NOT NULL,
        name TEXT NOT NULL,
        slaveId INTEGER NOT NULL,
        protocolTemplateId TEXT,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'ONLINE',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_devices_gatewayId ON devices(gatewayId);

      CREATE TABLE IF NOT EXISTS connection_protocols (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        port INTEGER NOT NULL,
        baudRate INTEGER,
        dataBits INTEGER,
        parity TEXT,
        stopBits INTEGER,
        timeout INTEGER NOT NULL DEFAULT 2000,
        retryCount INTEGER NOT NULL DEFAULT 3,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS control_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        points TEXT NOT NULL, -- JSON 格式存储点位数组
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        allowedDeviceIds TEXT NOT NULL, -- JSON 格式存储
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        feishuOpenId TEXT,
        feishuUserId TEXT,
        avatarUrl TEXT,
        email TEXT,
        mobile TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        operator TEXT NOT NULL,
        gatewayId TEXT NOT NULL,
        gatewayName TEXT NOT NULL,
        gatewayIp TEXT,
        deviceId TEXT NOT NULL,
        deviceName TEXT NOT NULL,
        slaveId INTEGER NOT NULL,
        pointKey TEXT NOT NULL,
        pointName TEXT NOT NULL,
        functionCode INTEGER NOT NULL,
        address INTEGER NOT NULL,
        previousValue TEXT, -- JSON 序列化
        value TEXT NOT NULL, -- JSON 序列化
        readbackValue TEXT, -- JSON 序列化
        executionTimeMs INTEGER,
        status TEXT NOT NULL,
        errorMsg TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_device ON audit_logs(deviceId);
    `);
  }

  /**
   * 平滑迁移逻辑：若存在 store.json 且 SQLite 无数据，自动全量导入
   */
  private checkAndMigrateLegacyData() {
    const userCount = (this.db.prepare("SELECT COUNT(*) as c FROM users").get() as any)?.c || 0;
    const gwCount = (this.db.prepare("SELECT COUNT(*) as c FROM gateways").get() as any)?.c || 0;

    if (userCount === 0 && gwCount === 0) {
      if (fs.existsSync(LEGACY_JSON_FILE)) {
        try {
          const raw = fs.readFileSync(LEGACY_JSON_FILE, "utf-8");
          const legacyData = JSON.parse(raw);
          console.log("[SQLite DB] 检测到历史 store.json，正在自动迁移至 anycontrol.db...");
          this.importBackup(legacyData, "OVERWRITE");
          console.log("[SQLite DB] 历史数据迁移完成！");
          return;
        } catch (e) {
          console.warn("[SQLite DB] 迁移历史 store.json 失败，将初始化默认干净数据:", e);
        }
      }
      this.initDefaultCleanData();
    }
  }

  private initDefaultCleanData() {
    for (const proto of INITIAL_DEFAULT_PROTOCOLS) {
      this.saveConnectionProtocol(proto);
    }
    this.saveUser(INITIAL_DEFAULT_ADMIN);
  }

  // =======================
  // 1. Gateways
  // =======================
  getGateways(): Gateway[] {
    const rows = this.db.prepare("SELECT * FROM gateways ORDER BY createdAt ASC").all() as any[];
    return rows.map(this.mapRowToGateway);
  }

  getGatewayById(id: string): Gateway | undefined {
    const row = this.db.prepare("SELECT * FROM gateways WHERE id = ?").get(id) as any;
    return row ? this.mapRowToGateway(row) : undefined;
  }

  saveGateway(gateway: Gateway): Gateway {
    const existing = this.getGatewayById(gateway.id);
    const now = new Date().toISOString();
    const updated: Gateway = {
      ...gateway,
      createdAt: gateway.createdAt || existing?.createdAt || now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO gateways (
        id, name, ip, managementPort, port, baud, dataBits, parity, stopBits,
        heartbeatInterval, latencyMs, wifiRssi, ramUsage, chipTemp, timeout,
        status, lastSyncTime, firmwareVersion, description, createdAt, updatedAt
      ) VALUES (
        @id, @name, @ip, @managementPort, @port, @baud, @dataBits, @parity, @stopBits,
        @heartbeatInterval, @latencyMs, @wifiRssi, @ramUsage, @chipTemp, @timeout,
        @status, @lastSyncTime, @firmwareVersion, @description, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        ip = excluded.ip,
        managementPort = excluded.managementPort,
        port = excluded.port,
        baud = excluded.baud,
        dataBits = excluded.dataBits,
        parity = excluded.parity,
        stopBits = excluded.stopBits,
        heartbeatInterval = excluded.heartbeatInterval,
        latencyMs = excluded.latencyMs,
        wifiRssi = excluded.wifiRssi,
        ramUsage = excluded.ramUsage,
        chipTemp = excluded.chipTemp,
        timeout = excluded.timeout,
        status = excluded.status,
        lastSyncTime = excluded.lastSyncTime,
        firmwareVersion = excluded.firmwareVersion,
        description = excluded.description,
        updatedAt = excluded.updatedAt
    `);

    stmt.run({
      id: updated.id,
      name: updated.name,
      ip: updated.ip,
      managementPort: updated.managementPort || 80,
      port: updated.port || 9502,
      baud: updated.baud || 9600,
      dataBits: updated.dataBits || 8,
      parity: updated.parity !== undefined ? updated.parity : 0,
      stopBits: updated.stopBits || 1,
      heartbeatInterval: updated.heartbeatInterval || 30,
      latencyMs: updated.latencyMs ?? null,
      wifiRssi: updated.wifiRssi ?? null,
      ramUsage: updated.ramUsage ?? null,
      chipTemp: updated.chipTemp ?? null,
      timeout: updated.timeout || 2000,
      status: updated.status || "UNKNOWN",
      lastSyncTime: updated.lastSyncTime ?? null,
      firmwareVersion: updated.firmwareVersion ?? null,
      description: updated.description || "",
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });

    return updated;
  }

  deleteGateway(id: string): boolean {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM devices WHERE gatewayId = ?").run(id);
      const res = this.db.prepare("DELETE FROM gateways WHERE id = ?").run(id);
      return res.changes > 0;
    });
    return tx();
  }

  private mapRowToGateway(row: any): Gateway {
    return {
      id: row.id,
      name: row.name,
      ip: row.ip,
      managementPort: row.managementPort,
      port: row.port,
      baud: row.baud,
      dataBits: row.dataBits,
      parity: row.parity,
      stopBits: row.stopBits,
      heartbeatInterval: row.heartbeatInterval,
      latencyMs: row.latencyMs ?? undefined,
      wifiRssi: row.wifiRssi ?? undefined,
      ramUsage: row.ramUsage ?? undefined,
      chipTemp: row.chipTemp ?? undefined,
      timeout: row.timeout,
      status: row.status,
      lastSyncTime: row.lastSyncTime ?? undefined,
      firmwareVersion: row.firmwareVersion ?? undefined,
      description: row.description ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // =======================
  // 2. Devices
  // =======================
  getDevices(): ControlledDevice[] {
    const rows = this.db.prepare("SELECT * FROM devices ORDER BY createdAt ASC").all() as any[];
    return rows.map(this.mapRowToDevice);
  }

  getDeviceById(id: string): ControlledDevice | undefined {
    const row = this.db.prepare("SELECT * FROM devices WHERE id = ?").get(id) as any;
    return row ? this.mapRowToDevice(row) : undefined;
  }

  saveDevice(device: ControlledDevice): ControlledDevice {
    const existing = this.getDeviceById(device.id);
    const now = new Date().toISOString();
    const updated: ControlledDevice = {
      ...device,
      createdAt: device.createdAt || existing?.createdAt || now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO devices (
        id, gatewayId, name, slaveId, protocolTemplateId, description, status, createdAt, updatedAt
      ) VALUES (
        @id, @gatewayId, @name, @slaveId, @protocolTemplateId, @description, @status, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        gatewayId = excluded.gatewayId,
        name = excluded.name,
        slaveId = excluded.slaveId,
        protocolTemplateId = excluded.protocolTemplateId,
        description = excluded.description,
        status = excluded.status,
        updatedAt = excluded.updatedAt
    `);

    stmt.run({
      id: updated.id,
      gatewayId: updated.gatewayId,
      name: updated.name,
      slaveId: updated.slaveId,
      protocolTemplateId: updated.protocolTemplateId || "",
      description: updated.description || "",
      status: updated.status || "ONLINE",
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });

    return updated;
  }

  deleteDevice(id: string): boolean {
    const res = this.db.prepare("DELETE FROM devices WHERE id = ?").run(id);
    return res.changes > 0;
  }

  private mapRowToDevice(row: any): ControlledDevice {
    return {
      id: row.id,
      gatewayId: row.gatewayId,
      name: row.name,
      slaveId: row.slaveId,
      protocolTemplateId: row.protocolTemplateId,
      description: row.description ?? undefined,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // =======================
  // 3. Connection Protocols
  // =======================
  getConnectionProtocols(): ConnectionProtocol[] {
    const rows = this.db.prepare("SELECT * FROM connection_protocols ORDER BY createdAt ASC").all() as any[];
    return rows.map(this.mapRowToConnectionProtocol);
  }

  saveConnectionProtocol(protocol: ConnectionProtocol): ConnectionProtocol {
    const now = new Date().toISOString();
    const updated: ConnectionProtocol = {
      ...protocol,
      createdAt: protocol.createdAt || now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO connection_protocols (
        id, name, type, port, baudRate, dataBits, parity, stopBits, timeout, retryCount, createdAt
      ) VALUES (
        @id, @name, @type, @port, @baudRate, @dataBits, @parity, @stopBits, @timeout, @retryCount, @createdAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        port = excluded.port,
        baudRate = excluded.baudRate,
        dataBits = excluded.dataBits,
        parity = excluded.parity,
        stopBits = excluded.stopBits,
        timeout = excluded.timeout,
        retryCount = excluded.retryCount
    `);

    stmt.run({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      port: updated.port,
      baudRate: updated.baudRate ?? null,
      dataBits: updated.dataBits ?? null,
      parity: updated.parity ?? null,
      stopBits: updated.stopBits ?? null,
      timeout: updated.timeout || 2000,
      retryCount: updated.retryCount || 3,
      createdAt: updated.createdAt,
    });

    return updated;
  }

  deleteConnectionProtocol(id: string): boolean {
    const res = this.db.prepare("DELETE FROM connection_protocols WHERE id = ?").run(id);
    return res.changes > 0;
  }

  private mapRowToConnectionProtocol(row: any): ConnectionProtocol {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      port: row.port,
      baudRate: row.baudRate ?? undefined,
      dataBits: row.dataBits ?? undefined,
      parity: row.parity ?? undefined,
      stopBits: row.stopBits ?? undefined,
      timeout: row.timeout,
      retryCount: row.retryCount,
      createdAt: row.createdAt,
    };
  }

  // =======================
  // 4. Control Protocol Templates
  // =======================
  getControlTemplates(): ControlProtocolTemplate[] {
    const rows = this.db.prepare("SELECT * FROM control_templates ORDER BY createdAt ASC").all() as any[];
    return rows.map(this.mapRowToControlTemplate);
  }

  getControlTemplateById(id: string): ControlProtocolTemplate | undefined {
    const row = this.db.prepare("SELECT * FROM control_templates WHERE id = ?").get(id) as any;
    return row ? this.mapRowToControlTemplate(row) : undefined;
  }

  saveControlTemplate(template: ControlProtocolTemplate): ControlProtocolTemplate {
    const existing = this.getControlTemplateById(template.id);
    const now = new Date().toISOString();
    const updated: ControlProtocolTemplate = {
      ...template,
      createdAt: template.createdAt || existing?.createdAt || now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO control_templates (id, name, description, points, createdAt, updatedAt)
      VALUES (@id, @name, @description, @points, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        points = excluded.points,
        updatedAt = excluded.updatedAt
    `);

    stmt.run({
      id: updated.id,
      name: updated.name,
      description: updated.description || "",
      points: JSON.stringify(updated.points || []),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });

    return updated;
  }

  deleteControlTemplate(id: string): boolean {
    const res = this.db.prepare("DELETE FROM control_templates WHERE id = ?").run(id);
    return res.changes > 0;
  }

  private mapRowToControlTemplate(row: any): ControlProtocolTemplate {
    let points = [];
    try {
      points = JSON.parse(row.points || "[]");
    } catch (_) {}
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      points,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // =======================
  // 5. Users
  // =======================
  getUsers(): User[] {
    const rows = this.db.prepare("SELECT * FROM users ORDER BY createdAt ASC").all() as any[];
    return rows.map(this.mapRowToUser);
  }

  getUserById(id: string): User | undefined {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    return row ? this.mapRowToUser(row) : undefined;
  }

  getUserByUsername(username: string): User | undefined {
    const row = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    return row ? this.mapRowToUser(row) : undefined;
  }

  getUserByFeishuId(feishuUserId?: string, feishuOpenId?: string): User | undefined {
    if (!feishuUserId && !feishuOpenId) return undefined;
    let row: any;
    if (feishuUserId && feishuOpenId) {
      row = this.db.prepare("SELECT * FROM users WHERE feishuUserId = ? OR feishuOpenId = ?").get(feishuUserId, feishuOpenId);
    } else if (feishuUserId) {
      row = this.db.prepare("SELECT * FROM users WHERE feishuUserId = ?").get(feishuUserId);
    } else {
      row = this.db.prepare("SELECT * FROM users WHERE feishuOpenId = ?").get(feishuOpenId);
    }
    return row ? this.mapRowToUser(row) : undefined;
  }

  saveUser(user: User): User {
    const existing = this.getUserById(user.id);
    const updated: User = {
      ...user,
      createdAt: user.createdAt || existing?.createdAt || new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, username, password, name, role, allowedDeviceIds, status,
        feishuOpenId, feishuUserId, avatarUrl, email, mobile, createdAt
      ) VALUES (
        @id, @username, @password, @name, @role, @allowedDeviceIds, @status,
        @feishuOpenId, @feishuUserId, @avatarUrl, @email, @mobile, @createdAt
      )
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        password = COALESCE(excluded.password, users.password),
        name = excluded.name,
        role = excluded.role,
        allowedDeviceIds = excluded.allowedDeviceIds,
        status = excluded.status,
        feishuOpenId = excluded.feishuOpenId,
        feishuUserId = excluded.feishuUserId,
        avatarUrl = excluded.avatarUrl,
        email = excluded.email,
        mobile = excluded.mobile
    `);

    stmt.run({
      id: updated.id,
      username: updated.username,
      password: updated.password ?? null,
      name: updated.name,
      role: updated.role,
      allowedDeviceIds: JSON.stringify(updated.allowedDeviceIds || []),
      status: updated.status || "ACTIVE",
      feishuOpenId: updated.feishuOpenId ?? null,
      feishuUserId: updated.feishuUserId ?? null,
      avatarUrl: updated.avatarUrl ?? null,
      email: updated.email ?? null,
      mobile: updated.mobile ?? null,
      createdAt: updated.createdAt,
    });

    return updated;
  }

  deleteUser(id: string): boolean {
    const res = this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
    return res.changes > 0;
  }

  private mapRowToUser(row: any): User {
    let allowedDeviceIds = [];
    try {
      allowedDeviceIds = JSON.parse(row.allowedDeviceIds || "[]");
    } catch (_) {}
    return {
      id: row.id,
      username: row.username,
      password: row.password ?? undefined,
      name: row.name,
      role: row.role,
      allowedDeviceIds,
      status: row.status,
      feishuOpenId: row.feishuOpenId ?? undefined,
      feishuUserId: row.feishuUserId ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      email: row.email ?? undefined,
      mobile: row.mobile ?? undefined,
      createdAt: row.createdAt,
    };
  }

  // =======================
  // 6. Audit Logs
  // =======================
  getAuditLogs(limit = 100): AuditLog[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY id DESC
      LIMIT ?
    `).all(limit) as any[];
    return rows.map(this.mapRowToAuditLog);
  }

  addAuditLog(log: Omit<AuditLog, "id">): AuditLog {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (
        timestamp, operator, gatewayId, gatewayName, gatewayIp,
        deviceId, deviceName, slaveId, pointKey, pointName,
        functionCode, address, previousValue, value, readbackValue,
        executionTimeMs, status, errorMsg
      ) VALUES (
        @timestamp, @operator, @gatewayId, @gatewayName, @gatewayIp,
        @deviceId, @deviceName, @slaveId, @pointKey, @pointName,
        @functionCode, @address, @previousValue, @value, @readbackValue,
        @executionTimeMs, @status, @errorMsg
      )
    `);

    const res = stmt.run({
      timestamp: log.timestamp,
      operator: log.operator,
      gatewayId: log.gatewayId,
      gatewayName: log.gatewayName,
      gatewayIp: log.gatewayIp ?? null,
      deviceId: log.deviceId,
      deviceName: log.deviceName,
      slaveId: log.slaveId,
      pointKey: log.pointKey,
      pointName: log.pointName,
      functionCode: log.functionCode,
      address: log.address,
      previousValue: log.previousValue !== undefined ? JSON.stringify(log.previousValue) : null,
      value: JSON.stringify(log.value),
      readbackValue: log.readbackValue !== undefined ? JSON.stringify(log.readbackValue) : null,
      executionTimeMs: log.executionTimeMs ?? null,
      status: log.status,
      errorMsg: log.errorMsg ?? null,
    });

    const newId = Number(res.lastInsertRowid);

    // 自动保持最多 10000 条日志（SQLite 下性能极高，扩大日志容量）
    this.db.prepare(`
      DELETE FROM audit_logs WHERE id NOT IN (
        SELECT id FROM audit_logs ORDER BY id DESC LIMIT 10000
      )
    `).run();

    return {
      id: newId,
      ...log,
    };
  }

  clearAuditLogs(): void {
    this.db.prepare("DELETE FROM audit_logs").run();
  }

  // =======================
  // 7. 系统全量配置备份与恢复
  // =======================
  exportBackup(): { version: string; system: string; exportedAt: string; data: any } {
    return {
      version: "2.0.0",
      system: "AnyControl Industrial Control Platform (SQLite Engine)",
      exportedAt: new Date().toISOString(),
      data: {
        gateways: this.getGateways(),
        devices: this.getDevices(),
        connectionProtocols: this.getConnectionProtocols(),
        controlTemplates: this.getControlTemplates(),
        users: this.getUsers(),
        auditLogs: this.getAuditLogs(1000),
      },
    };
  }

  importBackup(
    backupPayload: any,
    mode: "OVERWRITE" | "MERGE" = "OVERWRITE"
  ): {
    gatewaysCount: number;
    devicesCount: number;
    templatesCount: number;
    usersCount: number;
    logsCount: number;
  } {
    const rawData = backupPayload.data || backupPayload;

    const importedGateways: Gateway[] = Array.isArray(rawData.gateways) ? rawData.gateways : [];
    const importedDevices: ControlledDevice[] = Array.isArray(rawData.devices) ? rawData.devices : [];
    const importedProtocols: ConnectionProtocol[] = Array.isArray(rawData.connectionProtocols) ? rawData.connectionProtocols : [];
    const importedTemplates: ControlProtocolTemplate[] = Array.isArray(rawData.controlTemplates)
      ? rawData.controlTemplates
      : (Array.isArray(rawData.templates) ? rawData.templates : []);
    const importedUsers: User[] = Array.isArray(rawData.users) ? rawData.users : [];
    const importedLogs: AuditLog[] = Array.isArray(rawData.auditLogs)
      ? rawData.auditLogs
      : (Array.isArray(rawData.logs) ? rawData.logs : []);

    const tx = this.db.transaction(() => {
      if (mode === "OVERWRITE") {
        this.db.prepare("DELETE FROM devices").run();
        this.db.prepare("DELETE FROM gateways").run();
        this.db.prepare("DELETE FROM connection_protocols").run();
        this.db.prepare("DELETE FROM control_templates").run();
        this.db.prepare("DELETE FROM users").run();
        this.db.prepare("DELETE FROM audit_logs").run();
      }

      for (const gw of importedGateways) {
        this.saveGateway(gw);
      }
      for (const dev of importedDevices) {
        this.saveDevice(dev);
      }
      for (const proto of importedProtocols) {
        this.saveConnectionProtocol(proto);
      }
      for (const tpl of importedTemplates) {
        this.saveControlTemplate(tpl);
      }
      for (const u of importedUsers) {
        this.saveUser(u);
      }
      for (const log of importedLogs) {
        this.addAuditLog(log);
      }

      // 若覆盖后用户为空，补充默认管理员
      const currentUsers = this.getUsers();
      if (currentUsers.length === 0) {
        this.saveUser(INITIAL_DEFAULT_ADMIN);
      }
    });

    tx();

    return {
      gatewaysCount: this.getGateways().length,
      devicesCount: this.getDevices().length,
      templatesCount: this.getControlTemplates().length,
      usersCount: this.getUsers().length,
      logsCount: this.getAuditLogs(100).length,
    };
  }

  private mapRowToAuditLog(row: any): AuditLog {
    let previousValue: any = null;
    let value: any = row.value;
    let readbackValue: any = null;

    try {
      if (row.previousValue !== null && row.previousValue !== undefined) {
        previousValue = JSON.parse(row.previousValue);
      }
    } catch (_) { previousValue = row.previousValue; }

    try {
      value = JSON.parse(row.value);
    } catch (_) { value = row.value; }

    try {
      if (row.readbackValue !== null && row.readbackValue !== undefined) {
        readbackValue = JSON.parse(row.readbackValue);
      }
    } catch (_) { readbackValue = row.readbackValue; }

    return {
      id: row.id,
      timestamp: row.timestamp,
      operator: row.operator,
      gatewayId: row.gatewayId,
      gatewayName: row.gatewayName,
      gatewayIp: row.gatewayIp ?? undefined,
      deviceId: row.deviceId,
      deviceName: row.deviceName,
      slaveId: row.slaveId,
      pointKey: row.pointKey,
      pointName: row.pointName,
      functionCode: row.functionCode,
      address: row.address,
      previousValue,
      value,
      readbackValue,
      executionTimeMs: row.executionTimeMs ?? undefined,
      status: row.status,
      errorMsg: row.errorMsg ?? undefined,
    };
  }
}

export const db = new SQLiteDatabaseService();
