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
  lastSyncTime?: string;   // 最后一次配置/参数同步时间
  firmwareVersion?: string; // 设备固件版本
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ControlledDevice {
  id: string;
  gatewayId: string;
  name: string;
  slaveId: number; // Modbus总线地址 (1~247)
  protocolTemplateId: string; // 关联的控制协议模板
  description?: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'UNKNOWN';
  createdAt: string;
  updatedAt: string;
}

export type FunctionCode = 1 | 2 | 3 | 4 | 5 | 6 | 15 | 16;
export type DataType = 'BOOLEAN' | 'UINT16' | 'INT16' | 'UINT32' | 'INT32' | 'FLOAT32';
export type ByteOrder = 'ABCD' | 'CDAB' | 'BADC' | 'DCBA'; // 32位字节序: 大端/小端/字反转/字节反转
export type AccessPermission = 'RO' | 'RW' | 'WO';

export interface ControlPoint {
  id: string;
  name: string; // 点位中文名称 如: 1号泵启停
  key: string;  // 点位标识 如: pump_1_switch
  functionCode: FunctionCode; // Modbus功能码
  address: number; // 寄存器地址 (0-65535)
  dataType: DataType;
  registerCount: number; // 寄存器数量 (1 或 2)
  byteOrder?: ByteOrder; // 32位数值/浮点数字节序
  scale?: number; // 缩放倍率, 默认 1
  unit?: string;  // 工程单位 (℃, rpm, MPa, Hz, V, A等)
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
  baudRate?: number; // 9600, 19200, 38400, 115200
  dataBits?: 7 | 8;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: 1 | 2;
  timeout: number; // ms
  retryCount: number;
  createdAt: string;
}

export interface ControlProtocolTemplate {
  id: string;
  name: string; // 如: 变频器标准控制模板, 温控仪控制模板
  description?: string;
  points: ControlPoint[];
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  allowedDeviceIds: string[]; // 允许访问/控制的受控设备 ID 列表 (为空代表全部或无权限)
  status: 'ACTIVE' | 'DISABLED';
  feishuOpenId?: string;
  feishuUserId?: string;
  avatarUrl?: string;
  email?: string;
  mobile?: string;
  createdAt: string;
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
}

export interface ControlCommandRequest {
  operator?: string;
  deviceId: string;
  pointKey: string;
  value: number | boolean;
}
