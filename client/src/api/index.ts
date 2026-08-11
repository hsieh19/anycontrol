import axios from 'axios';
import { 
  Gateway, 
  ControlledDevice, 
  DeviceTreeNode,
  ConnectionProtocol, 
  ControlProtocolTemplate, 
  User, 
  AuditLog 
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

// C1 修复：每次请求自动携带 JWT Bearer Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('anycontrol_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// C1 修复：统一处理 401（令牌失效/过期），清除本地会话并刷新页面回到登录
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('anycontrol_token');
      localStorage.removeItem('anycontrol_user');
      // 避免在登录页触发死循环
      if (!window.location.href.includes('/login')) {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

// Control API
export const sendControlCommand = async (payload: {
  operator: string;
  deviceId: string;
  pointKey: string;
  value: number | boolean;
}) => {
  const res = await api.post<{ success: boolean; message: string; log: AuditLog }>('/control', payload);
  return res.data;
};

export const fetchDevicePointsStatus = async (deviceId: string) => {
  const res = await api.get<{ success: boolean; data: Record<string, { success: boolean; value: any; error?: string }> }>(`/device-points/${deviceId}`);
  return res.data;
};

// Device & Gateway API
export const getGateways = async () => {
  const res = await api.get<{ success: boolean; data: Gateway[] }>('/gateways');
  return res.data.data;
};

export const saveGateway = async (gw: Partial<Gateway>) => {
  const res = await api.post<{ success: boolean; data: Gateway }>('/gateways', gw);
  return res.data.data;
};

export const deleteGateway = async (id: string) => {
  const res = await api.delete<{ success: boolean }>(`/gateways/${id}`);
  return res.data.success;
};

export const testGatewayConnection = async (id: string) => {
  const res = await api.post<{
    success: boolean;
    data: {
      online: boolean;
      message: string;
      latencyMs?: number;
      telemetry?: {
        latencyMs?: number;
        wifiRssi?: number;
        ramUsage?: number;
        chipTemp?: number;
      };
    }
  }>(`/gateways/${id}/test`);
  return res.data.data;
};

export const pushConfigToGateway = async (id: string) => {
  const res = await api.post<{ success: boolean; data: { success: boolean; message: string; syncedAt: string; payloadSummary: any } }>(`/gateways/${id}/push-config`);
  return res.data.data;
};

export const pullConfigFromGateway = async (id: string) => {
  const res = await api.post<{ success: boolean; data: { success: boolean; message: string; syncedAt: string; deviceReport: any } }>(`/gateways/${id}/pull-config`);
  return res.data.data;
};

export const getDevices = async () => {
  const res = await api.get<{ success: boolean; data: ControlledDevice[] }>('/devices');
  return res.data.data;
};

export const saveDevice = async (dev: Partial<ControlledDevice>) => {
  const res = await api.post<{ success: boolean; data: ControlledDevice }>('/devices', dev);
  return res.data.data;
};

export const deleteDevice = async (id: string) => {
  const res = await api.delete<{ success: boolean }>(`/devices/${id}`);
  return res.data.success;
};

export const getDeviceTree = async () => {
  const res = await api.get<{ success: boolean; data: DeviceTreeNode[] }>('/device-tree');
  return res.data.data;
};

// Protocol API
export const getConnectionProtocols = async () => {
  const res = await api.get<{ success: boolean; data: ConnectionProtocol[] }>('/connection-protocols');
  return res.data.data;
};

export const saveConnectionProtocol = async (protocol: Partial<ConnectionProtocol>) => {
  const res = await api.post<{ success: boolean; data: ConnectionProtocol }>('/connection-protocols', protocol);
  return res.data.data;
};

export const deleteConnectionProtocol = async (id: string) => {
  const res = await api.delete<{ success: boolean }>(`/connection-protocols/${id}`);
  return res.data.success;
};

export const getControlTemplates = async () => {
  const res = await api.get<{ success: boolean; data: ControlProtocolTemplate[] }>('/control-templates');
  return res.data.data;
};

export const saveControlTemplate = async (template: Partial<ControlProtocolTemplate>) => {
  const res = await api.post<{ success: boolean; data: ControlProtocolTemplate }>('/control-templates', template);
  return res.data.data;
};

export const deleteControlTemplate = async (id: string) => {
  const res = await api.delete<{ success: boolean }>(`/control-templates/${id}`);
  return res.data.success;
};

// User API
export const getUsers = async () => {
  const res = await api.get<{ success: boolean; data: User[] }>('/users');
  return res.data.data;
};

export const saveUser = async (user: Partial<User>) => {
  const res = await api.post<{ success: boolean; data: User }>('/users', user);
  return res.data.data;
};

export const deleteUser = async (id: string) => {
  const res = await api.delete<{ success: boolean }>(`/users/${id}`);
  return res.data.success;
};

// Log API
export const getAuditLogs = async (params?: { limit?: number; operator?: string; status?: string; keyword?: string }) => {
  const res = await api.get<{ success: boolean; data: AuditLog[] }>('/logs', { params });
  return res.data.data;
};

export const clearAuditLogs = async () => {
  const res = await api.delete<{ success: boolean; message: string }>('/logs');
  return res.data;
};

// Auth & Feishu SSO API
export const loginWithPassword = async (username: string, password?: string) => {
  const res = await api.post<{ success: boolean; data: { user: User; token: string }; message?: string }>('/auth/login', {
    username,
    password
  });
  return res.data;
};

export const getFeishuConfig = async () => {
  const res = await api.get<{ success: boolean; data: { appId: string; redirectUri: string; isConfigured: boolean } }>('/feishu/config');
  return res.data.data;
};

export const saveFeishuConfig = async (appId: string, appSecret?: string) => {
  const res = await api.post<{ success: boolean; message: string; data: any }>('/feishu/config', {
    appId,
    appSecret
  });
  return res.data;
};

export const loginWithFeishu = async (code: string) => {
  const res = await api.post<{ success: boolean; data: { user: User; token: string }; message?: string }>('/feishu/login', {
    code
  });
  return res.data;
};

// System Backup & Restore API
export const exportSystemBackup = async () => {
  const res = await api.get<{ success: boolean; data: any }>('/system/backup');
  return res.data.data;
};

export const restoreSystemBackup = async (backupData: any, mode: 'OVERWRITE' | 'MERGE' = 'OVERWRITE') => {
  const res = await api.post<{ success: boolean; message: string; data: any }>('/system/restore', {
    backupData,
    mode
  });
  return res.data;
};
