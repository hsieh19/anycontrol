<template>
  <div class="control-view-container">
    <!-- Left: Device Tree Panel -->
    <div class="device-tree-panel industrial-card">
      <div class="panel-header">
        <div class="header-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
          </svg>
          <span>设备拓扑树</span>
        </div>
        <el-button size="small" circle @click="store.refreshAll" title="刷新拓扑">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </el-button>
      </div>

      <div class="search-box">
        <el-input 
          v-model="filterText" 
          placeholder="搜索网关 / 设备名称..." 
          clearable
          size="small"
        />
      </div>

      <div class="tree-content">
        <div 
          v-for="gw in filteredTree" 
          :key="gw.id" 
          class="gateway-group"
        >
          <!-- Level 1: Gateway Node -->
          <div class="gateway-node" @click="toggleGateway(gw.id)" :title="`网关名称: ${gw.name}\nIP 地址: ${gw.ip}`">
            <div class="node-left">
              <span class="expand-arrow" :class="{ expanded: !collapsedGateways[gw.id] }">▶</span>
              <span class="gw-badge">网关</span>
              <span class="gw-name" :title="`网关 IP: ${gw.ip}`">{{ gw.name }}</span>
            </div>
            <div class="node-right">
              <span class="status-dot" :class="gw.status === 'ONLINE' ? 'online' : 'offline'"></span>
              <span class="node-latency font-mono" :class="gw.status === 'ONLINE' ? 'text-emerald' : 'text-muted'" :title="`网络通信延迟: ${gw.latencyMs || 15}ms`">
                {{ gw.latencyMs !== undefined ? gw.latencyMs + 'ms' : (gw.status === 'ONLINE' ? '15ms' : '--') }}
              </span>
            </div>
          </div>

          <!-- Level 2: Controlled Devices -->
          <div v-show="!collapsedGateways[gw.id]" class="device-sublist">
            <div 
              v-for="dev in gw.children" 
              :key="dev.id"
              class="device-node"
              :class="{ 
                active: store.selectedDeviceId === dev.id,
                disabled: !isDeviceAccessible(dev.id)
              }"
              @click="selectDevice(dev.id)"
            >
              <div class="dev-main">
                <div class="dev-title-row">
                  <span class="slave-badge">从站 {{ dev.slaveId }}</span>
                  <span class="dev-name">{{ dev.name }}</span>
                </div>
                <div class="dev-meta-row">
                  <span class="tpl-tag">{{ dev.templateName }}</span>
                  <span v-if="!isDeviceAccessible(dev.id)" class="no-perm-tag">无操作权限</span>
                </div>
              </div>
              <div class="dev-status">
                <span class="status-indicator" :class="dev.status.toLowerCase()"></span>
              </div>
            </div>
            <div v-if="gw.children.length === 0" class="empty-child">
              暂无下属受控从站设备
            </div>
          </div>
        </div>

        <div v-if="filteredTree.length === 0" class="empty-tree">
          未检索到匹配的网关或设备
        </div>
      </div>
    </div>

    <!-- Right: Point Control Panel -->
    <div class="point-control-panel industrial-card">
      <div v-if="selectedDev" class="control-content">
        <!-- Panel Header -->
        <div class="control-header">
          <div class="dev-info-hero">
            <div class="title-with-badge">
              <h2>{{ selectedDev.name }}</h2>
              <span class="badge-accent">Slave ID: {{ selectedDev.slaveId }}</span>
              <span class="badge-gw">所属网关: {{ selectedDev.gateway.name }} ({{ selectedDev.gateway.ip }}:{{ currentCommPort }})</span>
            </div>
            <p class="dev-desc">{{ selectedDev.description || '标准工业控制从站设备，支持在线闭环控制与状态回读' }}</p>
          </div>

          <div class="header-actions">
            <el-button 
              type="primary" 
              plain 
              circle
              size="default"
              :loading="refreshingPoints"
              @click="refreshCurrentPoints"
              title="刷新当前从站物理寄存器状态"
            >
              <svg class="icon-btn" style="margin: 0; width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </el-button>
          </div>
        </div>

        <!-- Permission Notice if restricted -->
        <div v-if="!isDeviceAccessible(selectedDev.id)" class="permission-alert">
          <svg class="icon-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>当前操作员 [{{ store.currentUser.name }}] 未被授予该设备的下发控制权限，仅支持只读浏览。可在“用户管理”中进行授权。</span>
        </div>

        <!-- Control Points Grid -->
        <div class="points-section">
          <div class="section-title">
            <span class="accent-bar"></span>
            <h3>控制点位列表 (关联协议模板: {{ store.selectedTemplate?.name || '未绑定模板' }})</h3>
            <span class="points-count">{{ points.length }} 个控制点位</span>
          </div>

          <div v-if="points.length > 0" class="points-grid">
            <div 
              v-for="point in points" 
              :key="point.id" 
              class="point-card"
              :class="{
                'point-readonly': point.permission === 'RO',
                'point-executing': executingKey === point.key
              }"
            >
              <!-- Card Header -->
              <div class="card-top">
                <div class="point-name-box">
                  <span class="point-name">{{ point.name }}</span>
                  <span class="point-key font-mono">{{ point.key }}</span>
                </div>
                <div class="point-tags">
                  <el-tag size="small" effect="dark" :type="getFcTagType(point.functionCode)">
                    FC 0{{ point.functionCode }}
                  </el-tag>
                  <el-tag size="small" type="info" class="font-mono">
                    Addr: {{ point.address }}
                  </el-tag>
                </div>
              </div>

              <!-- Live Readback Value Status -->
              <div class="current-value-display">
                <div class="val-label">当前回读物理状态</div>
                <div class="val-content">
                  <template v-if="livePointStatus[point.key]?.success">
                    <span 
                      v-if="point.dataType === 'BOOLEAN'"
                      class="bool-indicator"
                      :class="livePointStatus[point.key].value ? 'state-on' : 'state-off'"
                    >
                      <span class="dot"></span>
                      {{ livePointStatus[point.key].value ? '运行 / 闭合 (ON)' : '停止 / 断开 (OFF)' }}
                    </span>
                    <span v-else class="num-value font-mono">
                      {{ livePointStatus[point.key].value }} <span class="unit">{{ point.unit }}</span>
                    </span>
                  </template>
                  <template v-else-if="livePointStatus[point.key]?.error">
                    <span class="val-error font-mono" :title="livePointStatus[point.key].error">
                      读取异常
                    </span>
                  </template>
                  <template v-else>
                    <span class="val-placeholder">-- 待同步 --</span>
                  </template>
                </div>
              </div>

              <!-- Control Action Element -->
              <div class="card-action-area">
                <!-- Case 1: Boolean Coil Control -->
                <div v-if="point.dataType === 'BOOLEAN'" class="bool-control-group">
                  <el-button 
                    type="success" 
                    size="default"
                    :disabled="!isDeviceAccessible(selectedDev.id) || point.permission === 'RO'"
                    :loading="executingKey === point.key && targetActionVal === true"
                    @click="requestCommand(point, true)"
                  >
                    置位 / 启动 (ON)
                  </el-button>
                  <el-button 
                    type="danger" 
                    size="default"
                    :disabled="!isDeviceAccessible(selectedDev.id) || point.permission === 'RO'"
                    :loading="executingKey === point.key && targetActionVal === false"
                    @click="requestCommand(point, false)"
                  >
                    复位 / 停止 (OFF)
                  </el-button>
                </div>

                <!-- Case 2: Numeric Holding Register Control -->
                <div v-else class="num-control-group">
                  <div class="input-row">
                    <el-input-number
                      v-model="inputValues[point.key]"
                      :min="point.minValue !== undefined ? point.minValue : 0"
                      :max="point.maxValue !== undefined ? point.maxValue : 65535"
                      :step="point.step || 1"
                      :precision="point.scale && point.scale < 1 ? 1 : 0"
                      size="default"
                      :disabled="!isDeviceAccessible(selectedDev.id) || point.permission === 'RO'"
                      class="custom-number-input"
                    />
                    <span v-if="point.unit" class="unit-addon">{{ point.unit }}</span>
                  </div>

                  <el-button
                    type="primary"
                    size="default"
                    class="write-btn"
                    :disabled="!isDeviceAccessible(selectedDev.id) || point.permission === 'RO'"
                    :loading="executingKey === point.key"
                    @click="requestCommand(point, inputValues[point.key])"
                  >
                    写入并校验
                  </el-button>
                </div>
              </div>

              <!-- Card Footer Metadata -->
              <div class="card-footer-meta">
                <span class="meta-item">类型: {{ point.dataType }}</span>
                <span class="meta-item">权限: {{ point.permission === 'RW' ? '读写(RW)' : point.permission === 'RO' ? '只读(RO)' : '只写(WO)' }}</span>
                <span v-if="point.scale && point.scale !== 1" class="meta-item">倍率: {{ point.scale }}</span>
              </div>
            </div>
          </div>

          <div v-else class="empty-points industrial-card">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            <p>该设备绑定的协议模板暂无控制点位配置</p>
            <el-button type="primary" size="small" @click="store.currentTab = 'protocols'">
              前往协议管理配置点位
            </el-button>
          </div>
        </div>
      </div>

      <div v-else class="no-dev-selected">
        <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <p>请在左侧设备拓扑树中选择一个受控从站设备以进行远程控制</p>
      </div>
    </div>

    <!-- Secondary Confirmation Dialog (工业高危操作二次确认模态框) -->
    <el-dialog
      v-model="confirmDialogVisible"
      title="⚠️ 工业控制指令下发二次确认"
      width="480px"
      :close-on-click-modal="false"
      class="custom-dialog"
    >
      <div v-if="pendingCommand" class="confirm-body">
        <p class="warning-text">您即将向现场设备下发物理控制指令，请核对目标参数：</p>
        <div class="confirm-details">
          <div class="detail-row">
            <span class="label">操作员：</span>
            <span class="value font-semibold">{{ store.currentUser.name }}</span>
          </div>
          <div class="detail-row">
            <span class="label">受控设备：</span>
            <span class="value">{{ selectedDev?.name }} (Slave ID: {{ selectedDev?.slaveId }})</span>
          </div>
          <div class="detail-row">
            <span class="label">网关地址：</span>
            <span class="value font-mono">{{ selectedDev?.gateway.ip }}:{{ currentCommPort }}</span>
          </div>
          <div class="detail-row">
            <span class="label">控制点位：</span>
            <span class="value font-semibold text-cyan">{{ pendingCommand.point.name }} ({{ pendingCommand.point.key }})</span>
          </div>
          <div class="detail-row">
            <span class="label">寄存器地址：</span>
            <span class="value font-mono">Addr {{ pendingCommand.point.address }} (FC 0{{ pendingCommand.point.functionCode }})</span>
          </div>

          <!-- 拆分为左右两列参数变更对比卡片 -->
          <div class="values-compare-card">
            <!-- 左列：当前物理值 -->
            <div class="compare-col current-col">
              <span class="compare-label">当前物理值</span>
              <div class="val-display-box">
                <span v-if="readingCurrentVal" class="val-loading text-muted">
                  <span class="spinner-sm"></span> 实时读取中...
                </span>
                <span v-else-if="currentPhysicalVal !== null && currentPhysicalVal !== undefined" class="val-num current-val font-mono">
                  {{ formatValue(currentPhysicalVal, pendingCommand.point) }}
                </span>
                <span v-else class="val-num text-muted font-mono">-</span>
              </div>
            </div>

            <!-- 中间过渡箭头 -->
            <div class="compare-arrow-box">
              <svg class="compare-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>

            <!-- 右列：本次下发目标值 -->
            <div class="compare-col target-col">
              <span class="compare-label">本次下发值</span>
              <div class="val-display-box">
                <span class="val-num target-val font-mono font-bold">
                  {{ formatValue(pendingCommand.value, pendingCommand.point) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="confirmDialogVisible = false">取消放弃</el-button>
          <el-button type="danger" :loading="executingCommand" @click="executeConfirmedCommand">
            确认下发指令
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue';
import { useAppStore } from '../stores/appStore';
import { ControlPoint } from '../types';
import * as api from '../api';
import { ElNotification, ElMessage } from 'element-plus';

const store = useAppStore();

const filterText = ref('');
const collapsedGateways = reactive<Record<string, boolean>>({});
const livePointStatus = ref<Record<string, { success: boolean; value: any; error?: string }>>({});
const inputValues = reactive<Record<string, number>>({});
const refreshingPoints = ref(false);

// Execution State
const executingKey = ref<string | null>(null);
const targetActionVal = ref<any>(null);
const executingCommand = ref(false);

// Confirmation modal state
const confirmDialogVisible = ref(false);
const pendingCommand = ref<{ point: ControlPoint; value: any } | null>(null);

const selectedDev = computed(() => store.selectedDevice);
const points = computed(() => store.selectedTemplate?.points || []);
const currentCommPort = computed(() => {
  return selectedDev.value?.gateway.port || 9502;
});

// Filtered Device Tree
const filteredTree = computed(() => {
  if (!filterText.value.trim()) return store.deviceTree;
  const kw = filterText.value.toLowerCase();

  return store.deviceTree
    .map(gw => {
      const matchGw = gw.name.toLowerCase().includes(kw) || gw.ip.includes(kw);
      const matchedChildren = gw.children.filter(d => 
        d.name.toLowerCase().includes(kw) || 
        d.slaveId.toString().includes(kw) ||
        d.templateName.toLowerCase().includes(kw)
      );
      if (matchGw || matchedChildren.length > 0) {
        return {
          ...gw,
          children: matchedChildren.length > 0 ? matchedChildren : gw.children
        };
      }
      return null;
    })
    .filter(Boolean) as typeof store.deviceTree;
});

const isDeviceAccessible = (deviceId: string) => {
  if (store.currentUser.role === 'ADMIN') return true;
  if (!store.currentUser.allowedDeviceIds) return false;
  return store.currentUser.allowedDeviceIds.includes(deviceId);
};

const toggleGateway = (gwId: string) => {
  collapsedGateways[gwId] = !collapsedGateways[gwId];
};

const selectDevice = (devId: string) => {
  store.selectedDeviceId = devId;
  initPointInputValues();
  refreshCurrentPoints();
};

const initPointInputValues = () => {
  if (!store.selectedTemplate) return;
  for (const pt of store.selectedTemplate.points) {
    if (pt.dataType !== 'BOOLEAN') {
      inputValues[pt.key] = pt.defaultValue !== undefined ? Number(pt.defaultValue) : (pt.minValue || 0);
    }
  }
};

const refreshCurrentPoints = async () => {
  if (!selectedDev.value) return;
  refreshingPoints.value = true;
  try {
    const res = await api.fetchDevicePointsStatus(selectedDev.value.id);
    if (res.success) {
      livePointStatus.value = res.data;
      // Sync numerical inputs if available
      for (const [k, v] of Object.entries(res.data)) {
        if (v.success && v.value !== null && typeof v.value === 'number') {
          inputValues[k] = v.value;
        }
      }
    }
  } catch (e: any) {
    ElMessage.warning(`读取设备实时值提示: ${e.message}`);
  } finally {
    refreshingPoints.value = false;
  }
};

const getFcTagType = (fc: number) => {
  switch (fc) {
    case 5: return 'success';
    case 6: return 'primary';
    case 15:
    case 16: return 'warning';
    default: return 'info';
  }
};

const formatValue = (val: any, point: ControlPoint) => {
  if (point.dataType === 'BOOLEAN') {
    return val ? '置位 开启 (TRUE / 1)' : '复位 关闭 (FALSE / 0)';
  }
  return `${val} ${point.unit || ''}`;
};

const readingCurrentVal = ref(false);
const currentPhysicalVal = ref<any>(null);

// Step 1: Open Confirmation Modal and Immediately Read Live Physical Value
const requestCommand = (point: ControlPoint, value: any) => {
  if (!selectedDev.value) return;
  if (!isDeviceAccessible(selectedDev.value.id)) {
    ElMessage.error('权限不足：当前用户无权操作此设备');
    return;
  }
  pendingCommand.value = { point, value };

  // 预填缓存中已有的值
  const cached = livePointStatus.value[point.key];
  if (cached && cached.success && cached.value !== null && cached.value !== undefined) {
    currentPhysicalVal.value = cached.value;
  } else {
    currentPhysicalVal.value = null;
  }

  confirmDialogVisible.value = true;

  // 点击写入时，立即触发一次现场物理寄存器实时读取刷新
  readingCurrentVal.value = true;
  api.fetchDevicePointsStatus(selectedDev.value.id).then(res => {
    if (res.success && res.data) {
      livePointStatus.value = res.data;
      if (res.data[point.key] && res.data[point.key].success && res.data[point.key].value !== null) {
        currentPhysicalVal.value = res.data[point.key].value;
      }
    }
  }).catch(err => {
    console.warn('Realtime pre-read error:', err);
  }).finally(() => {
    readingCurrentVal.value = false;
  });
};

// Step 2: Execute command after confirmation
const executeConfirmedCommand = async () => {
  if (!pendingCommand.value || !selectedDev.value) return;
  const { point, value } = pendingCommand.value;
  
  executingCommand.value = true;
  executingKey.value = point.key;
  targetActionVal.value = value;

  try {
    const res = await api.sendControlCommand({
      operator: store.currentUser.name,
      deviceId: selectedDev.value.id,
      pointKey: point.key,
      value
    });

    confirmDialogVisible.value = false;

    if (res.success) {
      ElNotification({
        title: '指令执行成功',
        message: `${point.name} -> 写入值 [${formatValue(value, point)}] 闭环校验通过 (${res.log.executionTimeMs}ms)`,
        type: 'success',
        duration: 4000
      });
      // Update local state immediately
      livePointStatus.value[point.key] = {
        success: true,
        value: res.log.readbackValue
      };
    } else {
      ElNotification({
        title: '指令执行异常',
        message: res.message || '总线响应失败',
        type: 'error',
        duration: 5000
      });
    }
  } catch (err: any) {
    ElNotification({
      title: '控制通信错误',
      message: err.response?.data?.message || err.message,
      type: 'error',
      duration: 5000
    });
  } finally {
    executingCommand.value = false;
    executingKey.value = null;
    targetActionVal.value = null;
    pendingCommand.value = null;
  }
};

watch(() => store.selectedDeviceId, () => {
  initPointInputValues();
  refreshCurrentPoints();
});

onMounted(() => {
  initPointInputValues();
  if (selectedDev.value) {
    refreshCurrentPoints();
  }
});
</script>

<style scoped>
.control-view-container {
  display: flex;
  gap: 20px;
  height: calc(100vh - 110px);
}

/* Left: Device Tree */
.device-tree-panel {
  width: 320px;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.icon {
  width: 18px;
  height: 18px;
  color: var(--accent-cyan);
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.search-box {
  margin-bottom: 12px;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.gateway-group {
  margin-bottom: 12px;
  border-radius: var(--radius-sm);
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.gateway-node {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #192336;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.gateway-node:hover {
  background: #202d44;
}

.node-left {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.expand-arrow {
  font-size: 10px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
  display: inline-block;
}

.expand-arrow.expanded {
  transform: rotate(90deg);
}

.gw-badge {
  background: #0284c7;
  color: #fff;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
}

.gw-name {
  font-size: 13px;
  font-weight: 500;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.online {
  background: var(--accent-green);
  box-shadow: 0 0 6px var(--accent-green);
}

.status-dot.offline {
  background: var(--accent-rose);
}

.node-ip {
  font-size: 11px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.node-latency {
  font-size: 11px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
}

.node-latency.text-muted {
  background: rgba(255, 255, 255, 0.05);
  border-color: transparent;
  color: var(--text-muted);
}

.device-sublist {
  padding: 4px;
}

.device-node {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  margin: 4px 0;
  border-radius: var(--radius-sm);
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.device-node:hover {
  background: #243247;
  border-color: #3b4d66;
}

.device-node.active {
  background: #173456;
  border-color: var(--accent-cyan);
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.2);
}

.device-node.disabled {
  opacity: 0.6;
}

.dev-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
}

.dev-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.slave-badge {
  background: #334155;
  color: #38bdf8;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  padding: 1px 4px;
  border-radius: 3px;
}

.dev-name {
  font-size: 13px;
  font-weight: 500;
  color: #f1f5f9;
}

.dev-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tpl-tag {
  font-size: 11px;
  color: var(--text-muted);
}

.no-perm-tag {
  font-size: 10px;
  background: rgba(244, 63, 94, 0.2);
  color: #fb7185;
  padding: 1px 4px;
  border-radius: 2px;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-green);
}

.empty-child, .empty-tree {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

/* Right: Control Panel */
.point-control-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto;
}

.control-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.title-with-badge h2 {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
}

.badge-accent {
  background: rgba(6, 182, 212, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.3);
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  padding: 2px 8px;
  border-radius: 4px;
}

.badge-gw {
  background: #1e293b;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.dev-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 6px;
}

.icon-btn {
  width: 16px;
  height: 16px;
  margin-right: 6px;
}

.permission-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-sm);
  color: #fcd34d;
  font-size: 13px;
}

.icon-alert {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.accent-bar {
  width: 4px;
  height: 16px;
  background: var(--accent-cyan);
  border-radius: 2px;
}

.section-title h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.points-count {
  font-size: 12px;
  color: var(--text-muted);
}

.points-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.point-card {
  background: #162032;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all 0.2s ease;
}

.point-card:hover {
  border-color: var(--border-light);
  transform: translateY(-1px);
}

.point-card.point-executing {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 14px rgba(6, 182, 212, 0.2);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.point-name-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.point-name {
  font-size: 15px;
  font-weight: 600;
  color: #f8fafc;
}

.point-key {
  font-size: 11px;
  color: var(--text-muted);
}

.point-tags {
  display: flex;
  gap: 6px;
}

.current-value-display {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.val-label {
  font-size: 12px;
  color: var(--text-muted);
}

.bool-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
}

.bool-indicator.state-on {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.bool-indicator.state-off {
  background: rgba(100, 116, 139, 0.2);
  color: #94a3b8;
}

.bool-indicator .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.num-value {
  font-size: 18px;
  font-weight: 700;
  color: #38bdf8;
}

.unit {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: 4px;
}

.val-placeholder {
  font-size: 12px;
  color: var(--text-muted);
}

.val-error {
  font-size: 12px;
  color: var(--accent-rose);
}

.card-action-area {
  padding-top: 4px;
}

.bool-control-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.num-control-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.input-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.custom-number-input {
  width: 100%;
}

.unit-addon {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 24px;
}

.write-btn {
  flex-shrink: 0;
}

.card-footer-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted);
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
}

.no-dev-selected, .empty-points {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
  gap: 12px;
}

.placeholder-icon, .empty-icon {
  width: 48px;
  height: 48px;
  color: var(--border-light);
}

/* Modal Styling */
.confirm-body {
  padding: 10px 0;
}

.warning-text {
  font-size: 14px;
  color: #fbbf24;
  margin-bottom: 16px;
}

.confirm-details {
  background: #111827;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.detail-row .label {
  color: var(--text-muted);
}

.detail-row .value {
  color: var(--text-primary);
}

.detail-row.highlight-row {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

/* 左右两列参数对比卡片 */
.values-compare-card {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.compare-col {
  flex: 1;
  background: #090e17;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-col.current-col {
  border-color: rgba(148, 163, 184, 0.2);
}

.compare-col.target-col {
  border-color: rgba(6, 182, 212, 0.4);
  background: rgba(6, 182, 212, 0.04);
}

.compare-label {
  font-size: 11px;
  color: var(--text-muted);
}

.val-display-box {
  min-height: 26px;
  display: flex;
  align-items: center;
}

.val-num {
  font-size: 17px;
}

.current-val {
  color: #94a3b8;
}

.target-val {
  color: var(--accent-cyan);
}

.val-loading {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.spinner-sm {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(148, 163, 184, 0.2);
  border-top-color: var(--accent-cyan);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.compare-arrow-box {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.compare-arrow-svg {
  width: 20px;
  height: 20px;
}

.text-cyan {
  color: var(--accent-cyan);
}
</style>
