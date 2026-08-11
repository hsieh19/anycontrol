<template>
  <div class="app-layout">
    <!-- Left Sidebar -->
    <aside class="sidebar">
      <!-- Logo & Title -->
      <div class="brand-header">
        <div class="brand-logo">
          <svg class="logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </div>
        <div class="brand-text">
          <h1>AnyControl</h1>
          <span class="brand-sub">工业设备控制与审计平台</span>
        </div>
      </div>

      <!-- Navigation Menu -->
      <nav class="nav-menu">
        <div 
          class="menu-item" 
          :class="{ active: store.currentTab === 'control' }"
          @click="store.currentTab = 'control'"
        >
          <div class="item-icon-box">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <span class="item-title">控制管理界面</span>
          <span class="badge-dot" v-if="store.currentTab === 'control'"></span>
        </div>

        <div 
          class="menu-item" 
          :class="{ active: store.currentTab === 'devices' }"
          @click="store.currentTab = 'devices'"
        >
          <div class="item-icon-box">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
          </div>
          <span class="item-title">设备管理界面</span>
          <span class="badge-dot" v-if="store.currentTab === 'devices'"></span>
        </div>

        <div 
          class="menu-item" 
          :class="{ active: store.currentTab === 'protocols' }"
          @click="store.currentTab = 'protocols'"
        >
          <div class="item-icon-box">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <span class="item-title">协议管理界面</span>
          <span class="badge-dot" v-if="store.currentTab === 'protocols'"></span>
        </div>

        <div 
          class="menu-item" 
          :class="{ active: store.currentTab === 'users' }"
          @click="store.currentTab = 'users'"
        >
          <div class="item-icon-box">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <span class="item-title">用户管理界面</span>
          <span class="badge-dot" v-if="store.currentTab === 'users'"></span>
        </div>

        <div 
          class="menu-item" 
          :class="{ active: store.currentTab === 'logs' }"
          @click="store.currentTab = 'logs'"
        >
          <div class="item-icon-box">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
          </div>
          <span class="item-title">操作日志审计</span>
          <span class="live-tag" v-if="store.wsConnected">LIVE</span>
          <span class="badge-dot" v-if="store.currentTab === 'logs'"></span>
        </div>
      </nav>

      <!-- Sidebar Footer Status -->
      <div class="sidebar-footer">
        <div class="system-status-box">
          <div class="status-row">
            <span class="status-dot online"></span>
            <span class="status-label">Modbus 串行排队引擎就绪</span>
          </div>
          <div class="status-row">
            <span class="status-dot" :class="store.wsConnected ? 'online' : 'offline'"></span>
            <span class="status-label">{{ store.wsConnected ? 'WebSocket 实时同步就绪' : 'WS 正在连接...' }}</span>
          </div>
        </div>

        <div class="version-info">
          <span>v1.0.0 Industrial Standard</span>
        </div>

        <!-- Current Operator Profile / Login Dropdown -->
        <el-dropdown trigger="click" placement="top-start" v-if="store.isLoggedIn">
          <div class="user-card-sidebar" title="点击展开用户操作菜单">
            <div class="user-avatar-sm" :class="`role-${store.currentUser.role.toLowerCase()}`">
              <img v-if="store.currentUser.avatarUrl" :src="store.currentUser.avatarUrl" class="avatar-img" />
              <span v-else>{{ store.currentUser.name.charAt(0) }}</span>
            </div>
            <div class="user-info-text">
              <span class="user-display-name">{{ store.currentUser.name }}</span>
              <span class="user-role-name">{{ getRoleDisplayName(store.currentUser.role) }}</span>
            </div>
            <svg class="user-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <template #dropdown>
            <el-dropdown-menu class="user-dropdown-menu">
              <el-dropdown-item @click="store.currentTab = 'users'">
                👥 用户与权限管理
              </el-dropdown-item>
              <el-dropdown-item @click="openFeishuConfigModal">
                ⚙️ 飞书应用集成配置
              </el-dropdown-item>
              <el-dropdown-item divided @click="handleLogout" style="color: #f43f5e;">
                🚪 退出当前登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <div v-else class="user-card-sidebar login-trigger-card" @click="showLoginModal = true">
          <div class="user-avatar-sm role-viewer">🔑</div>
          <div class="user-info-text">
            <span class="user-display-name text-cyan">未登录</span>
            <span class="user-role-name">点击登录 / 飞书免登</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="main-wrapper">
      <!-- Top Header -->
      <header class="top-header">
        <div class="header-left">
          <h2 class="view-title">{{ currentViewTitle }}</h2>
          <span class="view-desc">{{ currentViewDescription }}</span>
        </div>

        <div class="header-right">
          <!-- System Summary Badges -->
          <div class="stat-badge">
            <span class="stat-label">网关：</span>
            <span class="stat-val font-mono text-cyan">{{ store.deviceTree.length }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">从站设备：</span>
            <span class="stat-val font-mono text-cyan">{{ totalDevicesCount }}</span>
          </div>

          <!-- Backup & Restore System Action -->
          <div class="header-backup-btn">
            <el-button 
              size="default" 
              plain
              class="btn-backup-trigger"
              @click="openBackupModal"
            >
              <svg class="icon-btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              配置备份与恢复
            </el-button>
          </div>

          <!-- Page Primary Actions -->
          <div class="header-action-btn">
            <el-button 
              v-if="store.currentTab === 'devices'" 
              type="primary" 
              size="default" 
              @click="store.triggerAddGateway()"
            >
              + 注册新网关
            </el-button>

            <el-button 
              v-else-if="store.currentTab === 'protocols'" 
              type="primary" 
              size="default" 
              @click="store.triggerAddProtocol()"
            >
              + 新增协议模板
            </el-button>

            <el-button 
              v-else-if="store.currentTab === 'users'" 
              type="primary" 
              size="default" 
              @click="store.triggerAddUser()"
            >
              + 新增用户账号
            </el-button>
          </div>
        </div>
      </header>

      <!-- Dynamic View Container -->
      <main class="page-content">
        <transition name="fade-slide" mode="out-in">
          <ControlView v-if="store.currentTab === 'control'" key="control" />
          <DeviceView v-else-if="store.currentTab === 'devices'" key="devices" />
          <ProtocolView v-else-if="store.currentTab === 'protocols'" key="protocols" />
          <UserView v-else-if="store.currentTab === 'users'" key="users" />
          <LogsView v-else-if="store.currentTab === 'logs'" key="logs" />
        </transition>
      </main>
    </div>

    <!-- System Backup & Restore Modal -->
    <el-dialog
      v-model="backupModalVisible"
      title="📦 系统全量配置备份与灾难恢复"
      width="680px"
      :close-on-click-modal="false"
      class="backup-modal-dialog"
    >
      <div class="backup-modal-content">
        <!-- Tab 1: Export Card -->
        <div class="backup-card-section">
          <div class="card-sec-head">
            <div class="sec-title-box">
              <span class="sec-icon text-cyan">⬇️</span>
              <div>
                <h4>全量配置导出 (Export Backup)</h4>
                <p class="sec-desc">将当前系统的设备管理、协议模板与点位、用户访问权限、以及操作审计日志打包为 JSON 文件备份。</p>
              </div>
            </div>
            <el-button type="primary" :loading="exporting" @click="handleExportBackup">
              导出并下载备份包
            </el-button>
          </div>

          <!-- Current snapshot stats -->
          <div class="stats-preview-grid">
            <div class="stat-box">
              <span class="stat-num text-cyan font-mono">{{ store.deviceTree.length }}</span>
              <span class="stat-name">网关设备</span>
            </div>
            <div class="stat-box">
              <span class="stat-num text-cyan font-mono">{{ totalDevicesCount }}</span>
              <span class="stat-name">受控从站</span>
            </div>
            <div class="stat-box">
              <span class="stat-num text-cyan font-mono">{{ store.controlTemplates.length }}</span>
              <span class="stat-name">协议模板</span>
            </div>
            <div class="stat-box">
              <span class="stat-num text-cyan font-mono">{{ store.users.length }}</span>
              <span class="stat-name">用户账号</span>
            </div>
            <div class="stat-box">
              <span class="stat-num text-amber font-mono">{{ store.auditLogs.length }}</span>
              <span class="stat-name">审计日志</span>
            </div>
          </div>
        </div>

        <div class="divider-line"></div>

        <!-- Tab 2: Import Card -->
        <div class="backup-card-section">
          <div class="card-sec-head">
            <div class="sec-title-box">
              <span class="sec-icon text-emerald">⬆️</span>
              <div>
                <h4>配置导入与恢复 (Import & Restore)</h4>
                <p class="sec-desc">选择之前备份的 .json 格式配置文件，还原系统网关、协议点位、用户与日志。</p>
              </div>
            </div>
          </div>

          <!-- File upload / select area -->
          <div class="file-picker-row">
            <input 
              type="file" 
              ref="fileInputRef" 
              accept=".json" 
              style="display: none" 
              @change="onFileSelected"
            />
            <el-button plain @click="triggerFileInput">
              📁 选择备份文件 (.json)
            </el-button>
            <span class="selected-file-name" v-if="selectedFileName">
              已选择: <b>{{ selectedFileName }}</b>
            </span>
            <span class="selected-file-name text-muted" v-else>
              未选择文件
            </span>
          </div>

          <!-- Parsed File Preview if valid -->
          <div v-if="parsedBackupData" class="parsed-file-card">
            <div class="parsed-head">
              <span class="badge-valid">✅ 备份文件解析成功</span>
              <span class="export-time font-mono text-muted">备份时间: {{ formatBackupTime(parsedBackupData.exportedAt) }}</span>
            </div>

            <div class="parsed-stats-chips">
              <span class="chip-item">网关: <b>{{ (parsedBackupData.data?.gateways || parsedBackupData.gateways || []).length }}</b> 个</span>
              <span class="chip-item">从站: <b>{{ (parsedBackupData.data?.devices || parsedBackupData.devices || []).length }}</b> 个</span>
              <span class="chip-item">协议模板: <b>{{ (parsedBackupData.data?.controlTemplates || parsedBackupData.controlTemplates || []).length }}</b> 个</span>
              <span class="chip-item">用户: <b>{{ (parsedBackupData.data?.users || parsedBackupData.users || []).length }}</b> 个</span>
              <span class="chip-item">审计日志: <b>{{ (parsedBackupData.data?.auditLogs || parsedBackupData.auditLogs || []).length }}</b> 条</span>
            </div>

            <!-- Restore Mode Radio -->
            <div class="restore-mode-select">
              <span class="mode-label">恢复模式：</span>
              <el-radio-group v-model="restoreMode">
                <el-radio value="OVERWRITE">全量覆盖恢复 (清空并以备份完全替换)</el-radio>
                <el-radio value="MERGE">增量合并导入 (保留当前数据并追加合并)</el-radio>
              </el-radio-group>
            </div>

            <!-- Confirm restore button -->
            <div class="restore-act-row">
              <el-button 
                type="danger" 
                :loading="restoring" 
                @click="handleExecuteRestore"
              >
                🚀 确认执行系统恢复 ({{ restoreMode === 'OVERWRITE' ? '全量覆盖' : '增量合并' }})
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="backupModalVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- Login Modal (飞书免登 / 账号登录) -->
    <el-dialog
      v-model="showLoginModal"
      width="460px"
      :show-close="store.isLoggedIn"
      :close-on-click-modal="false"
      :close-on-press-escape="store.isLoggedIn"
      class="login-dialog-glass"
    >
      <div class="login-modal-body">
        <div class="login-brand-header">
          <div class="login-logo-box">
            <svg class="logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
          <h3>AnyControl 工业控制平台</h3>
          <p class="login-subtitle">请选择身份验证方式以进入工业控制与审计系统</p>
        </div>

        <!-- 飞书快捷登录区域 -->
        <div class="feishu-login-section">
          <el-button 
            type="primary" 
            class="btn-feishu-login" 
            :loading="feishuLoggingIn" 
            @click="handleFeishuLogin"
          >
            <svg class="feishu-svg-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            飞书账号一键快捷登录
          </el-button>
          <div class="feishu-hint" v-if="isFeishuEnv">
            <span class="pulse-dot"></span> 检测到处于飞书客户端环境，已就绪免登
          </div>
        </div>

        <div class="login-divider">
          <span>或使用工控操作员账号登录</span>
        </div>

        <!-- 传统密码登录表单 -->
        <div class="login-form-box">
          <div class="form-item-row">
            <el-input 
              v-model="loginForm.username" 
              placeholder="操作员账号 (例如: admin)" 
              size="large"
              @keyup.enter="handlePasswordLogin"
            >
              <template #prefix>
                <span class="input-icon">👤</span>
              </template>
            </el-input>
          </div>

          <div class="form-item-row">
            <el-input 
              v-model="loginForm.password" 
              type="password" 
              placeholder="密码 (默认: admin123)" 
              size="large"
              show-password
              @keyup.enter="handlePasswordLogin"
            >
              <template #prefix>
                <span class="input-icon">🔒</span>
              </template>
            </el-input>
          </div>

          <el-button 
            type="primary" 
            size="large" 
            class="btn-submit-login" 
            :loading="passwordLoggingIn"
            @click="handlePasswordLogin"
          >
            立即登录
          </el-button>
        </div>

        <!-- 底部飞书配置入口 -->
        <div class="login-footer-links">
          <el-link type="info" :underline="false" @click="openFeishuConfigModal">
            ⚙️ 配置飞书开放平台应用参数 (App ID / Secret)
          </el-link>
        </div>
      </div>
    </el-dialog>

    <!-- 飞书开放平台应用配置 Modal -->
    <el-dialog
      v-model="feishuConfigModalVisible"
      title="⚙️ 飞书开放平台集成配置"
      width="540px"
      :close-on-click-modal="false"
    >
      <div class="feishu-config-form">
        <p class="form-tip">
          请在 <a href="https://open.feishu.cn/" target="_blank" class="text-cyan">飞书开放平台</a> 创建企业自建应用，获取 App ID 与 App Secret，并在「安全设置」中将重定向 URL 配置为当前平台地址。
        </p>

        <el-form label-position="top">
          <el-form-item label="飞书 App ID (应用唯一标识)">
            <el-input v-model="feishuConfigForm.appId" placeholder="例如：cli_a1b2c3d4e5f6..." />
          </el-form-item>

          <el-form-item label="飞书 App Secret (应用凭证密钥)">
            <el-input v-model="feishuConfigForm.appSecret" type="password" show-password placeholder="例如：xYz123456789..." />
          </el-form-item>

          <el-form-item label="重定向回调地址 (Redirect URI)">
            <el-input v-model="feishuConfigForm.redirectUri" disabled />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="feishuConfigModalVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingFeishuConfig" @click="handleSaveFeishuConfig">
          保存配置
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useAppStore } from './stores/appStore';
import * as api from './api';
import { ElMessage, ElMessageBox } from 'element-plus';
import ControlView from './views/ControlView.vue';
import DeviceView from './views/DeviceView.vue';
import ProtocolView from './views/ProtocolView.vue';
import UserView from './views/UserView.vue';
import LogsView from './views/LogsView.vue';

const store = useAppStore();

// Backup & Restore Modal State
const backupModalVisible = ref(false);
const exporting = ref(false);
const restoring = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFileName = ref('');
const parsedBackupData = ref<any>(null);
const restoreMode = ref<'OVERWRITE' | 'MERGE'>('OVERWRITE');

const openBackupModal = () => {
  backupModalVisible.value = true;
};

const handleExportBackup = async () => {
  exporting.value = true;
  try {
    const backupPkg = await api.exportSystemBackup();
    const jsonStr = JSON.stringify(backupPkg, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `anycontrol_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    ElMessage.success('系统全量配置备份已导出并开始下载');
  } catch (e: any) {
    ElMessage.error('导出备份失败: ' + e.message);
  } finally {
    exporting.value = false;
  }
};

const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
    fileInputRef.value.click();
  }
};

const onFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const file = target.files[0];
  selectedFileName.value = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      const parsed = JSON.parse(content);
      if (!parsed || (typeof parsed !== 'object')) {
        throw new Error('无效的 JSON 格式');
      }
      parsedBackupData.value = parsed;
      ElMessage.success('备份文件已成功载入与解析');
    } catch (err: any) {
      ElMessage.error('读取解析备份文件失败: ' + err.message);
      parsedBackupData.value = null;
    }
  };
  reader.readAsText(file);
};

const formatBackupTime = (ts?: string) => {
  if (!ts) return '未知时间';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
};

const handleExecuteRestore = () => {
  if (!parsedBackupData.value) {
    ElMessage.warning('请先选择有效的备份配置文件');
    return;
  }

  const modeText = restoreMode.value === 'OVERWRITE' ? '全量覆盖恢复' : '增量合并导入';
  const confirmWarning = restoreMode.value === 'OVERWRITE'
    ? '⚠️ 警告：全量覆盖将清空当前系统的所有网关、设备、协议点位与用户，并以备份文件完全替换！是否继续？'
    : '确定将备份文件中的数据增量合并导入到当前系统中吗？';

  ElMessageBox.confirm(confirmWarning, `执行${modeText}`, {
    confirmButtonText: '确认执行恢复',
    cancelButtonText: '取消放弃',
    type: restoreMode.value === 'OVERWRITE' ? 'warning' : 'info'
  }).then(async () => {
    restoring.value = true;
    try {
      const res = await api.restoreSystemBackup(parsedBackupData.value, restoreMode.value);
      ElMessage.success(res.message || '系统恢复成功！');
      await store.refreshAll();
      backupModalVisible.value = false;
      parsedBackupData.value = null;
      selectedFileName.value = '';
    } catch (e: any) {
      ElMessage.error('系统恢复执行失败: ' + e.message);
    } finally {
      restoring.value = false;
    }
  });
};

const totalDevicesCount = computed(() => {
  return store.deviceTree.reduce((acc, gw) => acc + gw.children.length, 0);
});

const currentViewTitle = computed(() => {
  switch (store.currentTab) {
    case 'control': return '控制管理界面';
    case 'devices': return '设备管理界面';
    case 'protocols': return '协议管理界面';
    case 'users': return '用户与权限管理';
    case 'logs': return '操作与安全审计日志';
    default: return '';
  }
});

const currentViewDescription = computed(() => {
  switch (store.currentTab) {
    case 'control': return '二级设备树导航、Modbus 指令安全下发、串行队列与闭环状态校验';
    case 'devices': return '基于 IP 注册 Modbus TCP/IP 网关，基于 Slave ID 注册受控从站设备并绑定协议';
    case 'protocols': return '连接协议参数维护（端口/波特率/校验位）与控制协议点位（功能码/地址/类型）自定义配置';
    case 'users': return '管理操作员账号、分配受控设备访问白名单权限';
    case 'logs': return '全生命周期操作记录追踪，WebSocket 实时广播与 CSV 格式化导出';
    default: return '';
  }
});

const getRoleDisplayName = (role: string) => {
  switch (role) {
    case 'ADMIN': return '系统管理员';
    case 'OPERATOR': return '现场操作员';
    case 'AUDITOR': return '安全审计员';
    case 'VIEWER': return '只读观察员';
    default: return role;
  }
};

// Login & Feishu State
const showLoginModal = ref(false);
const feishuLoggingIn = ref(false);
const passwordLoggingIn = ref(false);
const isFeishuEnv = ref(/Lark|Feishu|LarkWebView|FeishuWebView/i.test(navigator.userAgent));

const loginForm = reactive({
  username: 'admin',
  password: ''
});

// Feishu Config Modal State
const feishuConfigModalVisible = ref(false);
const savingFeishuConfig = ref(false);
const feishuConfigForm = reactive({
  appId: '',
  appSecret: '',
  redirectUri: window.location.origin + window.location.pathname
});

const openFeishuConfigModal = async () => {
  try {
    const config = await api.getFeishuConfig();
    feishuConfigForm.appId = config.appId || '';
    feishuConfigForm.redirectUri = config.redirectUri || (window.location.origin + window.location.pathname);
  } catch (e) {}
  feishuConfigModalVisible.value = true;
};

const handleSaveFeishuConfig = async () => {
  if (!feishuConfigForm.appId) {
    ElMessage.warning('请输入飞书 App ID');
    return;
  }
  savingFeishuConfig.value = true;
  try {
    await api.saveFeishuConfig(feishuConfigForm.appId, feishuConfigForm.appSecret);
    ElMessage.success('飞书应用配置已更新保存');
    feishuConfigModalVisible.value = false;
  } catch (e: any) {
    ElMessage.error('保存失败: ' + e.message);
  } finally {
    savingFeishuConfig.value = false;
  }
};

const loadFeishuSdk = () => new Promise<void>((resolve, reject) => {
  if ((window as any).h5sdk) return resolve();
  const script = document.createElement('script');
  script.src = 'https://lf1-cdn-tos.bytegoofy.com/goofy/lark/op/h5-js-sdk-1.5.23.js';
  script.onload = () => resolve();
  script.onerror = () => reject(new Error('无法加载飞书 JSSDK 脚本'));
  document.head.appendChild(script);
});

const waitSdkReady = () => new Promise<void>((resolve) => {
  try {
    if ((window as any).h5sdk && typeof (window as any).h5sdk.ready === 'function') {
      (window as any).h5sdk.ready(() => resolve());
      return;
    }
  } catch (_) {}
  resolve();
});

const getAuthApi = () => {
  const w = window as any;
  const candidates = [w.tt, w.lark, w.feishu, w.h5sdk && w.h5sdk.tt].filter(Boolean);
  return candidates.find(api => api && typeof api.requestAuthCode === 'function') || null;
};

const handleFeishuLogin = async () => {
  feishuLoggingIn.value = true;
  try {
    const config = await api.getFeishuConfig();
    if (!config || !config.appId) {
      ElMessageBox.alert(
        '当前系统尚未配置飞书开放平台的 App ID 与 App Secret，无法发起飞书第三方授权登录。\n\n请先点击下方「配置飞书应用参数」录入飞书凭据，或直接使用操作员账号密码（admin / admin123）登录。',
        '飞书集成参数未配置',
        {
          confirmButtonText: '去配置飞书参数',
          type: 'warning'
        }
      ).then(() => {
        openFeishuConfigModal();
      }).catch(() => {});
      feishuLoggingIn.value = false;
      return;
    }

    if (isFeishuEnv.value) {
      await loadFeishuSdk();
      await waitSdkReady();
      const authApi = getAuthApi();
      if (authApi) {
        authApi.requestAuthCode({
          appId: config.appId,
          success: async (res: any) => {
            const code = res && res.code;
            if (code) {
              const loginRes = await api.loginWithFeishu(code);
              if (loginRes.success && loginRes.data) {
                store.setUser(loginRes.data.user, loginRes.data.token);
                ElMessage.success(`飞书免登成功！欢迎：${loginRes.data.user.name}`);
                showLoginModal.value = false;
                await store.refreshAll();
              }
            }
          },
          fail: (err: any) => {
            ElMessage.error('获取飞书授权码失败: ' + (typeof err === 'string' ? err : JSON.stringify(err)));
          }
        });
        return;
      }
    }

    // Web Browser Redirect to Feishu OAuth2
    const redirectUri = encodeURIComponent(config.redirectUri || window.location.href);
    window.location.href = `https://open.feishu.cn/open-apis/authen/v1/index?app_id=${config.appId}&redirect_uri=${redirectUri}`;
  } catch (err: any) {
    ElMessage.error('飞书登录初始化失败: ' + err.message);
  } finally {
    feishuLoggingIn.value = false;
  }
};

const handlePasswordLogin = async () => {
  if (!loginForm.username) {
    ElMessage.warning('请输入操作员账号 (例如: admin)');
    return;
  }
  if (!loginForm.password) {
    ElMessage.warning('请输入密码 (默认密码: admin123)');
    return;
  }
  passwordLoggingIn.value = true;
  try {
    const res = await api.loginWithPassword(loginForm.username, loginForm.password);
    if (res.success && res.data) {
      store.setUser(res.data.user, res.data.token);
      ElMessage.success(`登录成功，欢迎：${res.data.user.name}`);
      showLoginModal.value = false;
      await store.refreshAll();
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '登录失败，请检查账号或密码');
  } finally {
    passwordLoggingIn.value = false;
  }
};

const handleLogout = () => {
  ElMessageBox.confirm('确定退出当前操作员登录状态吗？', '退出登录确认', {
    type: 'warning',
    confirmButtonText: '确认退出',
    cancelButtonText: '取消'
  }).then(() => {
    store.logout();
    ElMessage.info('已退出登录');
    showLoginModal.value = true;
  });
};

const checkUrlAuthCode = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (code) {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);

    try {
      ElMessage.info('正在验证飞书授权凭证...');
      const res = await api.loginWithFeishu(code);
      if (res.success && res.data) {
        store.setUser(res.data.user, res.data.token);
        ElMessage.success(`飞书认证成功！欢迎操作员：${res.data.user.name}`);
        showLoginModal.value = false;
        await store.refreshAll();
        return;
      }
    } catch (e: any) {
      ElMessage.error('飞书授权登录失败: ' + (e.message || '未知异常'));
    }
  }

  // Check stored auth
  const hasAuth = store.checkStoredAuth();
  if (!hasAuth) {
    showLoginModal.value = true;
    // If not logged in, auto-attempt silent login if in Feishu
    if (isFeishuEnv.value) {
      handleFeishuLogin();
    }
  }
};

onMounted(() => {
  checkUrlAuthCode();
  store.refreshAll();
  store.initWebSocket();
});
</script>

<style scoped>
.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  background-color: var(--bg-primary);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 250px;
  min-width: 250px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  user-select: none;
}

.brand-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 18px;
  border-bottom: 1px solid var(--border-color);
}

.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, #0284c7, #06b6d4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.3);
}

.logo-svg {
  width: 20px;
  height: 20px;
}

.brand-text h1 {
  font-size: 17px;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.2;
  letter-spacing: 0.5px;
}

.brand-sub {
  font-size: 11px;
  color: var(--text-muted);
}

.nav-menu {
  flex: 1;
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.menu-item.active {
  background: #173456;
  color: #38bdf8;
  font-weight: 600;
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.15);
}

.item-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-icon {
  width: 18px;
  height: 18px;
}

.item-title {
  font-size: 14px;
  flex: 1;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-cyan);
  box-shadow: 0 0 6px var(--accent-cyan);
}

.live-tag {
  font-size: 9px;
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.sidebar-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--border-color);
  background: #0d1424;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.system-status-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-dot.online {
  background: var(--accent-green);
  box-shadow: 0 0 6px var(--accent-green);
}

.status-dot.offline {
  background: var(--accent-rose);
}

.version-info {
  font-size: 10px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

/* Main Area */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.top-header {
  height: 64px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.view-title {
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
}

.view-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #1e293b;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.stat-label {
  color: var(--text-muted);
}

.stat-val {
  font-weight: 700;
}

.text-cyan {
  color: var(--accent-cyan);
}

.user-card-sidebar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.user-card-sidebar:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(6, 182, 212, 0.3);
}

.user-arrow-icon {
  width: 12px;
  height: 12px;
  color: var(--text-muted);
  margin-left: auto;
  opacity: 0.6;
}

.user-avatar-sm {
  width: 22px;
  height: 22px;
  min-width: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}

.user-avatar-sm.role-admin {
  background: linear-gradient(135deg, #ef4444, #b91c1c);
}

.user-avatar-sm.role-operator {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
}

.user-avatar-sm.role-auditor {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.user-avatar-sm.role-viewer {
  background: linear-gradient(135deg, #64748b, #475569);
}

.user-info-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
}

.user-display-name {
  font-size: 12px;
  font-weight: 500;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role-name {
  font-size: 10px;
  color: var(--text-muted);
}

.page-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Backup & Restore Modal Styles */
.header-backup-btn {
  display: flex;
  align-items: center;
}

.btn-backup-trigger {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  color: #cbd5e1;
}

.btn-backup-trigger:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
}

.icon-btn-svg {
  width: 14px;
  height: 14px;
  margin-right: 6px;
}

.backup-modal-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.backup-card-section {
  background: #111a28;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-sec-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sec-title-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.sec-icon {
  font-size: 20px;
}

.sec-title-box h4 {
  font-size: 14px;
  font-weight: 700;
  color: #f1f5f9;
}

.sec-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  max-width: 440px;
  line-height: 1.4;
}

.stats-preview-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.stat-box {
  background: #0b111c;
  border: 1px solid #1e293b;
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-num {
  font-size: 16px;
  font-weight: 700;
}

.stat-name {
  font-size: 11px;
  color: var(--text-muted);
}

.divider-line {
  height: 1px;
  background: var(--border-color);
}

.file-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-file-name {
  font-size: 12px;
  color: var(--text-secondary);
}

.parsed-file-card {
  background: #090e17;
  border: 1px solid rgba(52, 211, 153, 0.3);
  border-radius: 6px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.parsed-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.badge-valid {
  font-size: 12px;
  font-weight: 700;
  color: #34d399;
}

.export-time {
  font-size: 11px;
}

.parsed-stats-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-item {
  background: #141f30;
  border: 1px solid #1e2e46;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.chip-item b {
  color: var(--accent-cyan);
}

.restore-mode-select {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
}

.mode-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.restore-act-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

/* User Avatar Image */
.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.login-trigger-card {
  border-color: rgba(6, 182, 212, 0.4) !important;
  background: rgba(6, 182, 212, 0.08) !important;
}

/* Login Modal Glass & Aesthetics */
.login-modal-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 8px 4px;
}

.login-brand-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.login-logo-box {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2));
  border: 1px solid rgba(6, 182, 212, 0.4);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-cyan);
}

.login-brand-header h3 {
  font-size: 18px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: 0.5px;
}

.login-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.feishu-login-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-feishu-login {
  width: 100%;
  height: 44px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, #00d6b9, #007bff) !important;
  border: none !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 14px rgba(0, 123, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.btn-feishu-login:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 123, 255, 0.45);
}

.feishu-svg-icon {
  width: 20px;
  height: 20px;
}

.feishu-hint {
  font-size: 11px;
  color: #34d399;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 6px #34d399;
}

.login-divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: var(--text-muted);
  font-size: 11px;
}

.login-divider::before,
.login-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--border-color);
}

.login-divider span {
  padding: 0 10px;
}

.login-form-box {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item-row {
  display: flex;
  flex-direction: column;
}

.input-icon {
  font-size: 14px;
  margin-right: 4px;
}

.btn-submit-login {
  width: 100%;
  height: 42px;
  font-weight: 600;
  border-radius: 6px;
  margin-top: 4px;
}

.login-footer-links {
  text-align: center;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.feishu-config-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-tip {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.2);
  padding: 10px 14px;
  border-radius: 6px;
}
</style>
