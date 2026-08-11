import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  User, 
  DeviceTreeNode, 
  ControlledDevice, 
  AuditLog, 
  ControlProtocolTemplate 
} from '../types';
import * as api from '../api';

export const useAppStore = defineStore('app', () => {
  // Navigation
  const currentTab = ref<'control' | 'devices' | 'protocols' | 'users' | 'logs'>('control');

  // Users & Auth
  const users = ref<User[]>([]);
  const isLoggedIn = ref(false);
  const authToken = ref('');
  const currentUser = ref<User>({
    id: 'usr-admin',
    username: 'admin',
    name: '系统管理员 (Admin)',
    role: 'ADMIN',
    allowedDeviceIds: [],
    status: 'ACTIVE'
  });

  const setUser = (user: User, token?: string) => {
    currentUser.value = user;
    isLoggedIn.value = true;
    if (token) {
      authToken.value = token;
      localStorage.setItem('anycontrol_token', token);
    }
    localStorage.setItem('anycontrol_user', JSON.stringify(user));
  };

  const logout = () => {
    isLoggedIn.value = false;
    authToken.value = '';
    localStorage.removeItem('anycontrol_token');
    localStorage.removeItem('anycontrol_user');
  };

  const checkStoredAuth = () => {
    try {
      const storedToken = localStorage.getItem('anycontrol_token');
      const storedUser = localStorage.getItem('anycontrol_user');
      if (storedToken && storedUser) {
        // I6 修复：解析 JWT Payload 检查 exp 字段，避免使用已过期令牌
        try {
          const payloadBase64 = storedToken.split('.')[1];
          const payload = JSON.parse(atob(payloadBase64));
          if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
            // Token 已过期，清除本地会话
            localStorage.removeItem('anycontrol_token');
            localStorage.removeItem('anycontrol_user');
            return false;
          }
        } catch (parseErr) {
          // Token 格式无效，清除
          localStorage.removeItem('anycontrol_token');
          localStorage.removeItem('anycontrol_user');
          return false;
        }
        currentUser.value = JSON.parse(storedUser);
        authToken.value = storedToken;
        isLoggedIn.value = true;
        return true;
      }
    } catch (e) {}
    return false;
  };

  // Device Tree & Selection
  const deviceTree = ref<DeviceTreeNode[]>([]);
  const selectedDeviceId = ref<string>('');
  const controlTemplates = ref<ControlProtocolTemplate[]>([]);

  // Logs & Real-time WS
  const auditLogs = ref<AuditLog[]>([]);
  const wsConnected = ref(false);
  let ws: WebSocket | null = null;

  // Selected device computed
  const selectedDevice = computed(() => {
    for (const gw of deviceTree.value) {
      const dev = gw.children.find(d => d.id === selectedDeviceId.value);
      if (dev) {
        return {
          ...dev,
          gateway: gw
        };
      }
    }
    return null;
  });

  // Selected device's template computed
  const selectedTemplate = computed(() => {
    if (!selectedDevice.value) return null;
    return controlTemplates.value.find(t => t.id === selectedDevice.value?.protocolTemplateId) || null;
  });

  // Version
  const appVersion = ref(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.1');

  // Fetch all core data
  const refreshAll = async () => {
    try {
      const [tree, tpls, userList, logs] = await Promise.all([
        api.getDeviceTree(),
        api.getControlTemplates(),
        api.getUsers(),
        api.getAuditLogs({ limit: 100 })
      ]);
      deviceTree.value = tree;
      controlTemplates.value = tpls;
      users.value = userList;
      auditLogs.value = logs;

      // 核心：自动同步当前登录用户的最新角色与权限信息（提权即刻生效）
      if (currentUser.value && userList && userList.length > 0) {
        const latestSelf = userList.find(u => u.id === currentUser.value.id || u.username === currentUser.value.username);
        if (latestSelf) {
          currentUser.value = { ...currentUser.value, ...latestSelf };
          localStorage.setItem('anycontrol_user', JSON.stringify(currentUser.value));
        }
      }

      // Select first device if not selected
      if (!selectedDeviceId.value && tree.length > 0 && tree[0].children.length > 0) {
        selectedDeviceId.value = tree[0].children[0].id;
      }
    } catch (e) {
      console.error('Failed to load initial data:', e);
    }
  };

  // Init WebSocket (单例模式与防重机制)
  let reconnectTimer: any = null;

  const initWebSocket = () => {
    if (ws) {
      try {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      } catch (e) {}
      ws = null;
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        wsConnected.value = true;
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'AUDIT_LOG' && payload.data) {
            const newLog = { ...payload.data, isNew: true };
            
            // 严格按 ID 去重，防止多连接或重发产生两条相同记录
            const existsIdx = auditLogs.value.findIndex(l => l.id === newLog.id);
            if (existsIdx >= 0) {
              auditLogs.value[existsIdx] = newLog;
            } else {
              auditLogs.value.unshift(newLog);
            }

            // 保持内存最多 300 条
            if (auditLogs.value.length > 300) {
              auditLogs.value = auditLogs.value.slice(0, 300);
            }
          }
        } catch (err) {}
      };

      ws.onclose = () => {
        wsConnected.value = false;
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            initWebSocket();
          }, 3000);
        }
      };

      ws.onerror = () => {
        wsConnected.value = false;
      };
    } catch (e) {
      console.warn('WebSocket init error:', e);
    }
  };

  const openAddGatewayEvent = ref(0);
  const openAddProtocolEvent = ref(0);
  const openAddUserEvent = ref(0);

  const triggerAddGateway = () => { openAddGatewayEvent.value++; };
  const triggerAddProtocol = () => { openAddProtocolEvent.value++; };
  const triggerAddUser = () => { openAddUserEvent.value++; };

  return {
    currentTab,
    users,
    currentUser,
    isLoggedIn,
    authToken,
    setUser,
    logout,
    checkStoredAuth,
    deviceTree,
    selectedDeviceId,
    selectedDevice,
    selectedTemplate,
    controlTemplates,
    auditLogs,
    wsConnected,
    openAddGatewayEvent,
    openAddProtocolEvent,
    openAddUserEvent,
    triggerAddGateway,
    triggerAddProtocol,
    triggerAddUser,
    refreshAll,
    initWebSocket,
    appVersion
  };
});
