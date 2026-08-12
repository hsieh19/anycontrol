export interface Gateway {
  id: string;
  name: string;
  ip: string;
  managementPort: number; // 心跳与参数同步管理端口 (默认 80)
  port?: number;           // Modbus TCP Server 端口 (默认 9502)
  baud?: number;           // 串口波特率 (默认 9600)
  dataBits?: 7 | 8;        // 数据位 (默认 8)
  parity?: number;         // 校验位 (0: None, 1: Even, 2: Odd)
  stopBits?: 1 | 2;        // 停止位 (默认 1)
  heartbeatInterval?: number; // 心跳保活周期 (秒，默认 30)
  latencyMs?: number;         // 网络往返延迟 (ms)
  wifiRssi?: number;          // WiFi 信号强度 (dBm)
  ramUsage?: number;          // 内存占用率 (%)
  chipTemp?: number;          // 芯片内部结温 (℃)
  timeout?: number;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  lastSyncTime?: string;
  firmwareVersion?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ControlledDevice {
  id: string;
  gatewayId: string;
  name: string;
  slaveId: number;
  protocolTemplateId: string;
  description?: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'UNKNOWN';
  templateName?: string;
  pointsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceTreeNode extends Gateway {
  type: 'gateway';
  children: (ControlledDevice & { templateName: string; pointsCount: number })[];
}

export type FunctionCode = 1 | 2 | 3 | 4 | 5 | 6 | 15 | 16;
export type DataType = 'BOOLEAN' | 'UINT16' | 'INT16' | 'UINT32' | 'INT32' | 'FLOAT32';
export type ByteOrder = 'ABCD' | 'CDAB' | 'BADC' | 'DCBA';
export type AccessPermission = 'RO' | 'RW' | 'WO';

export interface ControlPoint {
  id: string;
  name: string;
  key: string;
  functionCode: FunctionCode;
  address: number;
  dataType: DataType;
  registerCount: number;
  byteOrder?: ByteOrder;
  scale?: number;
  unit?: string;
  permission: AccessPermission;
  minValue?: number;
  maxValue?: number;
  defaultValue?: number | boolean;
  step?: number;
}

export interface ConnectionProtocol {
  id: string;
  name: string;
  type: 'MODBUS_TCP' | 'MODBUS_RTU_OVER_TCP';
  port: number;
  baudRate?: number;
  dataBits?: 7 | 8;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: 1 | 2;
  timeout: number;
  retryCount: number;
  createdAt?: string;
}

export interface ControlProtocolTemplate {
  id: string;
  name: string;
  description?: string;
  points: ControlPoint[];
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  allowedDeviceIds: string[];
  status: 'ACTIVE' | 'DISABLED';
  feishuOpenId?: string;
  feishuUserId?: string;
  avatarUrl?: string;
  email?: string;
  mobile?: string;
  createdAt?: string;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  operator: string;
  gatewayId: string;
  gatewayName: string;
  gatewayIp?: string;
  deviceId: string;
  deviceName: string;
  slaveId: number;
  pointKey: string;
  pointName: string;
  functionCode: number;
  address: number;
  previousValue?: number | boolean | null;
  value: number | boolean;
  readbackValue?: number | boolean | null;
  executionTimeMs?: number;
  status: 'SUCCESS' | 'FAILED';
  errorMsg?: string;
  isNew?: boolean; // For animated flash in UI
}
