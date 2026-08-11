<template>
  <div class="device-view-container">
    <!-- Gateways Single-Row List (单排网关及下挂受控设备) -->
    <div class="gateway-rows-container">
      <div 
        v-for="gw in gateways" 
        :key="gw.id" 
        class="gateway-row-card industrial-card"
      >
        <!-- Gateway Header Row (网关主体信息与操作) -->
        <div class="gw-main-row" @click="toggleCollapse(gw.id)">
          <!-- Left: Expand icon, Name, Status, IP, Port, Count -->
          <div class="gw-left-meta">
            <span class="collapse-icon" :class="{ expanded: !collapsedMap[gw.id] }">▶</span>
            
            <div class="gw-status-badge">
              <span class="status-indicator" :class="gw.status === 'ONLINE' ? 'online' : 'offline'"></span>
              <span class="gw-title">{{ gw.name }}</span>
            </div>

            <div class="meta-tags clickable-telemetry" @click.stop="openTelemetryModal(gw)" title="点击查看网关硬件状态与通讯延迟深度诊断">
              <span class="meta-tag font-mono text-cyan">
                IP: {{ gw.ip }}
              </span>
              <span class="meta-tag-count">
                {{ getDevicesForGw(gw.id).length }} 台受控从站
              </span>
              <!-- 遥测实时指标组 (点击查看详情) -->
              <span class="meta-tag font-mono text-emerald">
                📶 {{ gw.latencyMs !== undefined ? gw.latencyMs + 'ms' : '--' }}
              </span>
              <span class="meta-tag font-mono text-amber">
                📡 {{ gw.wifiRssi !== undefined ? gw.wifiRssi + 'dBm' : '--' }}
              </span>
              <span class="meta-tag font-mono text-violet">
                🧠 {{ gw.ramUsage !== undefined ? gw.ramUsage + '%' : '--' }}
              </span>
              <span class="meta-tag font-mono text-rose">
                🌡️ {{ gw.chipTemp !== undefined ? gw.chipTemp + '℃' : '--' }}
              </span>
              <span v-if="gw.lastSyncTime" class="meta-sync-time text-muted font-mono text-xs">
                同步: {{ formatTime(gw.lastSyncTime) }}
              </span>
            </div>
          </div>

          <!-- Right: Gateway Operations Group (阻止冒泡防止点击按钮时触发折叠) -->
          <div class="gw-right-actions" @click.stop>
            <el-button 
              size="small" 
              type="success" 
              @click="openDeviceDialog(undefined, gw.id)"
              title="为此网关添加新的受控从站设备"
            >
              <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              + 注册受控设备
            </el-button>

            <el-button 
              size="small" 
              type="primary" 
              plain 
              :loading="pushingGwId === gw.id"
              @click="promptPushConfig(gw)"
              title="核对并下发通信串口参数至硬件网关"
            >
              ⬆️ 下发配置
            </el-button>

            <el-button size="small" type="primary" link @click="openGatewayDialog(gw)">
              编辑网关
            </el-button>

            <el-button size="small" type="danger" link @click="handleDeleteGateway(gw)">
              删除网关
            </el-button>
          </div>
        </div>

        <!-- Subordinate Controlled Devices Table (下挂受控设备区域，支持折叠) -->
        <div v-show="!collapsedMap[gw.id]" class="subordinate-devices-wrapper">
          <div v-if="getDevicesForGw(gw.id).length > 0" class="subordinate-table">
            <el-table 
              :data="getDevicesForGw(gw.id)" 
              stripe 
              size="small"
              style="width: 100%"
            >
              <el-table-column prop="name" label="受控从站名称" min-width="160">
                <template #default="{ row }">
                  <div class="dev-cell">
                    <span class="sub-branch-icon">↳</span>
                    <span class="font-semibold text-slate">{{ row.name }}</span>
                  </div>
                </template>
              </el-table-column>

              <el-table-column prop="slaveId" label="总线地址 (Slave ID)" width="160">
                <template #default="{ row }">
                  <el-tag size="small" type="info" class="font-mono font-bold">
                    从站 #{{ row.slaveId }}
                  </el-tag>
                </template>
              </el-table-column>

              <el-table-column label="绑定控制协议模板" min-width="200">
                <template #default="{ row }">
                  <el-tag size="small" type="primary">
                    {{ getTemplateName(row.protocolTemplateId) }}
                  </el-tag>
                </template>
              </el-table-column>

              <el-table-column prop="description" label="说明 / 工艺位置" min-width="180">
                <template #default="{ row }">
                  <span class="text-muted text-xs">{{ row.description || '-' }}</span>
                </template>
              </el-table-column>

              <el-table-column label="从站操作" width="140" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" type="primary" link @click="openDeviceDialog(row)">编辑</el-button>
                  <el-button size="small" type="danger" link @click="handleDeleteDevice(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div v-else class="empty-sub-devices">
            <span class="text-muted text-xs">当前网关下暂无受控设备</span>
            <el-button 
              size="small" 
              type="success" 
              link 
              @click="openDeviceDialog(undefined, gw.id)"
            >
              + 立即注册下挂从站设备
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="gateways.length === 0" class="empty-gateway-card industrial-card">
        <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
          <line x1="6" y1="6" x2="6.01" y2="6"></line>
          <line x1="6" y1="18" x2="6.01" y2="18"></line>
        </svg>
        <p>当前系统暂无注册网关，请点击右上角「+ 注册新网关」开始配置</p>
      </div>
    </div>

    <!-- Gateway Edit/Add Dialog -->
    <el-dialog
      v-model="gwDialogVisible"
      :title="editingGw.id ? '编辑网关配置' : '注册新 Modbus 网关'"
      width="520px"
    >
      <el-form label-width="120px">
        <el-form-item label="网关名称" required>
          <el-input v-model="editingGw.name" placeholder="例如: 1号车间智能网关" />
        </el-form-item>

        <el-form-item label="网关 IP 地址" required>
          <el-input v-model="editingGw.ip" placeholder="例如: 172.17.213.113" />
        </el-form-item>

        <el-form-item label="RS485 波特率">
          <el-select v-model="editingGw.baud" placeholder="选择波特率" style="width: 100%">
            <el-option :value="2400" label="2400 bps" />
            <el-option :value="4800" label="4800 bps" />
            <el-option :value="9600" label="9600 bps" />
            <el-option :value="19200" label="19200 bps" />
            <el-option :value="38400" label="38400 bps" />
            <el-option :value="57600" label="57600 bps" />
            <el-option :value="115200" label="115200 bps" />
          </el-select>
        </el-form-item>

        <el-form-item label="数据位 / 校验">
          <div style="display: flex; gap: 10px; width: 100%;">
            <el-select v-model="editingGw.dataBits" style="flex: 1">
              <el-option :value="8" label="8 位" />
              <el-option :value="7" label="7 位" />
            </el-select>
            <el-select v-model="editingGw.parity" style="flex: 1">
              <el-option :value="0" label="None 无校验" />
              <el-option :value="1" label="Even 偶校验" />
              <el-option :value="2" label="Odd 奇校验" />
            </el-select>
          </div>
        </el-form-item>

        <el-form-item label="停止位">
          <el-select v-model="editingGw.stopBits" style="width: 100%">
            <el-option :value="1" label="1 位" />
            <el-option :value="2" label="2 位" />
          </el-select>
        </el-form-item>

        <el-form-item label="心跳保活周期">
          <el-input-number v-model="editingGw.heartbeatInterval" :min="5" :max="3600" style="width: 100%" />
          <span class="input-tip">硬件固件心跳保活周期 (单位: 秒，默认 30)</span>
        </el-form-item>

        <el-form-item label="备注说明">
          <el-input v-model="editingGw.description" type="textarea" :rows="2" placeholder="物理安装位置或工艺段说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="gwDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingGw" @click="saveGatewayForm">保存网关</el-button>
      </template>
    </el-dialog>

    <!-- Device Edit/Add Dialog (自动关联归属网关) -->
    <el-dialog
      v-model="devDialogVisible"
      :title="editingDev.id ? '编辑受控从站设备' : '注册受控从站设备'"
      width="520px"
    >
      <el-form label-width="130px">
        <el-form-item label="归属网关" required>
          <el-select v-model="editingDev.gatewayId" placeholder="选择上级网关" style="width: 100%">
            <el-option
              v-for="gw in gateways"
              :key="gw.id"
              :label="`${gw.name} (${gw.ip})`"
              :value="gw.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="受控设备名称" required>
          <el-input v-model="editingDev.name" placeholder="例如: 1号空调 / 冷却循环泵" />
        </el-form-item>
        <el-form-item label="总线从站地址" required>
          <el-input-number v-model="editingDev.slaveId" :min="1" :max="247" />
          <span class="input-tip">Modbus Slave ID (1~247)</span>
        </el-form-item>
        <el-form-item label="绑定协议模板" required>
          <el-select v-model="editingDev.protocolTemplateId" placeholder="选择控制点位模板" style="width: 100%">
            <el-option
              v-for="tpl in controlTemplates"
              :key="tpl.id"
              :label="`${tpl.name} (${tpl.points.length}个点位)`"
              :value="tpl.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注说明">
          <el-input v-model="editingDev.description" type="textarea" :rows="2" placeholder="安装位置或工艺说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="devDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingDev" @click="saveDeviceForm">保存从站</el-button>
      </template>
    </el-dialog>

    <!-- Secondary Confirmation Dialog for Gateway Config Push (网关配置下发二次确认模态框) -->
    <el-dialog
      v-model="pushConfirmVisible"
      title="⚠️ 网关串口通信参数下发二次确认"
      width="520px"
      :close-on-click-modal="false"
      class="custom-dialog"
    >
      <div v-if="targetPushGw" class="push-confirm-body">
        <p class="push-warning-text">您即将向现场硬件网关下发物理通讯参数，请核对目标配置：</p>
        
        <div class="confirm-details-box">
          <div class="detail-row">
            <span class="label">操作员：</span>
            <span class="value font-semibold">{{ store.currentUser.name }}</span>
          </div>
          <div class="detail-row">
            <span class="label">目标网关：</span>
            <span class="value font-bold text-cyan">{{ targetPushGw.name }}</span>
          </div>
          <div class="detail-row">
            <span class="label">网关 IP 地址：</span>
            <span class="value font-mono">{{ targetPushGw.ip }} (HTTP 端口: {{ targetPushGw.managementPort || 80 }})</span>
          </div>
        </div>

        <div class="param-summary-card">
          <div class="param-title">📋 本次下发的通信参数清单</div>
          <div class="param-grid">
            <div class="param-item">
              <span class="p-name">RS485 波特率</span>
              <span class="p-val font-mono font-bold">{{ targetPushGw.baud || 9600 }} bps</span>
            </div>
            <div class="param-item">
              <span class="p-name">数据位</span>
              <span class="p-val font-mono font-bold">{{ targetPushGw.dataBits || 8 }} 位</span>
            </div>
            <div class="param-item">
              <span class="p-name">校验位</span>
              <span class="p-val font-mono font-bold">{{ getParityLabel(targetPushGw.parity) }}</span>
            </div>
            <div class="param-item">
              <span class="p-name">停止位</span>
              <span class="p-val font-mono font-bold">{{ targetPushGw.stopBits || 1 }} 位</span>
            </div>
            <div class="param-item">
              <span class="p-name">心跳保活周期</span>
              <span class="p-val font-mono font-bold">{{ targetPushGw.heartbeatInterval || 30 }} 秒</span>
            </div>
            <div class="param-item" style="grid-column: span 2;">
              <span class="p-name">WiFi TCP 服务端口</span>
              <span class="p-val font-mono font-bold">{{ targetPushGw.port || 9502 }}</span>
            </div>
          </div>
        </div>

        <div class="notice-callout">
          <span>💡 确认下发后，硬件固件将自动保存到 NVS 并热重载 RS485 串口。</span>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="pushConfirmVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            :loading="pushingGwId === targetPushGw?.id" 
            @click="confirmAndExecutePush"
          >
            确认下发参数
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Gateway Telemetry Diagnostics Dialog (网关状态与通讯指标遥测弹窗) -->
    <el-dialog
      v-model="telemetryDialogVisible"
      title="📊 网关硬件状态与通讯延迟诊断"
      width="640px"
      class="telemetry-modal"
    >
      <div v-if="currentTelemetry" class="telemetry-body">
        <div class="telemetry-header-card">
          <div class="gw-name-row">
            <span class="gw-title font-bold text-cyan">{{ currentTelemetry.gwName }}</span>
            <el-tag type="success" size="small" class="font-mono">固件 {{ currentTelemetry.report.firmware }}</el-tag>
          </div>
          <div class="gw-ip-row font-mono text-muted text-xs">
            IP: {{ currentTelemetry.gwIp }} | 同步于: {{ formatTime(currentTelemetry.syncedAt) }}
          </div>
        </div>

        <div class="telemetry-grid">
          <!-- 延迟指标 -->
          <div class="stat-card">
            <div class="stat-label">📶 网络往返延迟</div>
            <div class="stat-value font-mono text-emerald">
              {{ currentTelemetry.report.networkLatencyMs }} <span class="unit">ms</span>
            </div>
            <div class="stat-tip">上位机至网关 HTTP 通信耗时</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">⚡ RS485 总线应答延迟</div>
            <div class="stat-value font-mono text-cyan">
              {{ currentTelemetry.report.busLatencyMs }} <span class="unit">ms</span>
            </div>
            <div class="stat-tip">网关与物理从站通信耗时</div>
          </div>

          <!-- 硬件健康 -->
          <div class="stat-card">
            <div class="stat-label">📡 WiFi 信号强度</div>
            <div class="stat-value font-mono text-amber">
              {{ currentTelemetry.report.rssi }} <span class="unit">dBm</span>
            </div>
            <div class="stat-tip">现场无线接入质量</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">🌡️ ESP32 芯片温度</div>
            <div class="stat-value font-mono text-rose">
              {{ currentTelemetry.report.chipTemp }} <span class="unit">℃</span>
            </div>
            <div class="stat-tip">硬件内部结温监控</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">🧠 内存使用率</div>
            <div class="stat-value font-mono text-violet">
              {{ currentTelemetry.report.ram }} <span class="unit">%</span>
            </div>
            <div class="stat-tip">堆内存动态健康监测</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">⏱️ 连续开机运行时间</div>
            <div class="stat-value font-mono text-indigo font-semibold" style="font-size: 1.05rem;">
              {{ currentTelemetry.report.uptime }}
            </div>
            <div class="stat-tip">自上次通电以来的运行时间</div>
          </div>

          <!-- 中继吞吐 -->
          <div class="stat-card" style="grid-column: span 2;">
            <div class="stat-label">🔄 双主站中继调度与错误统计</div>
            <div class="dual-stat-row font-mono">
              <span>物理主站 (RS485_A): <b class="text-cyan">{{ currentTelemetry.report.master1Frames }}</b> 帧</span>
              <span>WiFi 主站 (Master 2): <b class="text-emerald">{{ currentTelemetry.report.master2Frames }}</b> 帧</span>
              <span :class="currentTelemetry.report.busCrcErrors > 0 ? 'text-danger' : 'text-success'">CRC 错误: <b>{{ currentTelemetry.report.busCrcErrors }}</b></span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="telemetryDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '../stores/appStore';
import { Gateway, ControlledDevice } from '../types';
import * as api from '../api';
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus';

const store = useAppStore();

// 监听顶栏 "+ 注册新网关" 触发事件
watch(() => store.openAddGatewayEvent, () => {
  openGatewayDialog();
});

const gateways = ref<Gateway[]>([]);
const devices = ref<ControlledDevice[]>([]);
const controlTemplates = ref(store.controlTemplates);

// 折叠映射表 (默认全部展开)
const collapsedMap = reactive<Record<string, boolean>>({});

const testingGwId = ref<string | null>(null);
const pushingGwId = ref<string | null>(null);
const pullingGwId = ref<string | null>(null);

// Dialogs
const gwDialogVisible = ref(false);
const savingGw = ref(false);
const editingGw = reactive<Partial<Gateway>>({
  name: '',
  ip: '127.0.0.1',
  managementPort: 8080,
  description: ''
});

const devDialogVisible = ref(false);
const savingDev = ref(false);
const editingDev = reactive<Partial<ControlledDevice>>({
  name: '',
  gatewayId: '',
  slaveId: 1,
  protocolTemplateId: '',
  description: ''
});

const loadData = async () => {
  try {
    const [gws, devs, tpls] = await Promise.all([
      api.getGateways(),
      api.getDevices(),
      api.getControlTemplates()
    ]);
    gateways.value = gws;
    devices.value = devs;
    controlTemplates.value = tpls;
  } catch (e: any) {
    ElMessage.error('加载设备数据失败: ' + e.message);
  }
};

const toggleCollapse = (gwId: string) => {
  collapsedMap[gwId] = !collapsedMap[gwId];
};

const getDevicesForGw = (gwId: string) => {
  return devices.value.filter(d => d.gatewayId === gwId);
};

const getTemplateName = (tplId: string) => {
  const t = controlTemplates.value.find(tpl => tpl.id === tplId);
  return t ? t.name : '未绑定模板';
};

const formatTime = (ts: string) => {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { hour12: false });
};

// 后台静默心跳探测 (自动更新状态徽章)
const silentHeartbeatCheck = async (gw: Gateway) => {
  try {
    const res = await api.testGatewayConnection(gw.id);
    if (res.online) {
      gw.status = 'ONLINE';
      if (res.telemetry) {
        gw.latencyMs = res.telemetry.latencyMs;
        gw.wifiRssi = res.telemetry.wifiRssi;
        gw.ramUsage = res.telemetry.ramUsage;
        gw.chipTemp = res.telemetry.chipTemp;
      } else {
        gw.latencyMs = res.latencyMs;
      }
    } else {
      gw.status = 'OFFLINE';
    }
  } catch {
    gw.status = 'OFFLINE';
  }
};

let heartbeatTimer: any = null;

const startHeartbeatPolling = () => {
  stopHeartbeatPolling();
  heartbeatTimer = setInterval(() => {
    gateways.value.forEach(gw => {
      silentHeartbeatCheck(gw);
    });
  }, 15000); // 每 15 秒静默轮询一次最新遥测与网络延迟
};

const stopHeartbeatPolling = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

// 下发配置 (触发二次确认)
const pushConfirmVisible = ref(false);
const targetPushGw = ref<Gateway | null>(null);

const promptPushConfig = (gw: Gateway) => {
  targetPushGw.value = gw;
  pushConfirmVisible.value = true;
};

const getParityLabel = (parity?: number) => {
  if (parity === 1) return 'Even (偶校验)';
  if (parity === 2) return 'Odd (奇校验)';
  return 'None (无校验)';
};

// 确认并执行下发
const confirmAndExecutePush = async () => {
  if (!targetPushGw.value) return;
  const gw = targetPushGw.value;
  pushingGwId.value = gw.id;
  try {
    const res = await api.pushConfigToGateway(gw.id);
    if (res.success) {
      gw.lastSyncTime = res.syncedAt;
      ElNotification({
        title: '配置下发成功',
        message: res.message,
        type: 'success',
        duration: 4000
      });
      pushConfirmVisible.value = false;
      await loadData();
    }
  } catch (e: any) {
    ElNotification({
      title: '配置下发失败',
      message: e.message || '网络无法到达设备管理端口',
      type: 'error'
    });
  } finally {
    pushingGwId.value = null;
  }
};

// 遥测诊断弹窗
const telemetryDialogVisible = ref(false);
const currentTelemetry = ref<{ gwName: string; gwIp: string; syncedAt: string; report: any } | null>(null);

const openTelemetryModal = async (gw: Gateway) => {
  currentTelemetry.value = {
    gwName: gw.name,
    gwIp: gw.ip,
    syncedAt: gw.lastSyncTime || new Date().toISOString(),
    report: {
      firmware: gw.firmwareVersion || 'v2.0.0',
      networkLatencyMs: gw.latencyMs || 15,
      busLatencyMs: 38,
      rssi: gw.wifiRssi || -58,
      chipTemp: gw.chipTemp || 36.2,
      ram: gw.ramUsage || 42,
      uptime: '正常运行中',
      master1Frames: 0,
      master2Frames: 0,
      busCrcErrors: 0
    }
  };
  telemetryDialogVisible.value = true;
  
  // 静默拉取最新详细指标
  try {
    const res = await api.pullConfigFromGateway(gw.id);
    if (res.success) {
      currentTelemetry.value = {
        gwName: gw.name,
        gwIp: gw.ip,
        syncedAt: res.syncedAt,
        report: res.deviceReport
      };
    }
  } catch {}
};

// Gateway Modal Handlers
const openGatewayDialog = (gw?: Gateway) => {
  if (gw) {
    Object.assign(editingGw, {
      ...gw,
      managementPort: gw.managementPort || 80,
      baud: gw.baud || 9600,
      dataBits: gw.dataBits || 8,
      parity: gw.parity !== undefined ? gw.parity : 0,
      stopBits: gw.stopBits || 1,
      heartbeatInterval: gw.heartbeatInterval || 30
    });
  } else {
    Object.assign(editingGw, {
      id: undefined,
      name: '',
      ip: '172.17.213.113',
      managementPort: 80,
      port: 9502,
      baud: 9600,
      dataBits: 8,
      parity: 0,
      stopBits: 1,
      heartbeatInterval: 30,
      description: ''
    });
  }
  gwDialogVisible.value = true;
};

const saveGatewayForm = async () => {
  if (!editingGw.name || !editingGw.ip) {
    ElMessage.warning('请填写网关名称和 IP 地址');
    return;
  }
  savingGw.value = true;
  try {
    await api.saveGateway(editingGw);
    ElMessage.success('网关配置已保存');
    gwDialogVisible.value = false;
    await loadData();
    await store.refreshAll();
  } catch (e: any) {
    ElMessage.error('保存网关失败: ' + e.message);
  } finally {
    savingGw.value = false;
  }
};

const handleDeleteGateway = (gw: Gateway) => {
  ElMessageBox.confirm(
    `确定删除网关 [${gw.name}] 吗？将同时清除其下属受控从站设备。`,
    '删除确认',
    { type: 'warning' }
  ).then(async () => {
    try {
      await api.deleteGateway(gw.id);
      ElMessage.success('网关已删除');
      await loadData();
      await store.refreshAll();
    } catch (e: any) {
      ElMessage.error('删除失败: ' + e.message);
    }
  });
};

// Device Modal Handlers
const openDeviceDialog = (dev?: ControlledDevice, preselectedGwId?: string) => {
  if (dev) {
    Object.assign(editingDev, dev);
  } else {
    Object.assign(editingDev, {
      id: undefined,
      name: '',
      gatewayId: preselectedGwId || (gateways.value.length > 0 ? gateways.value[0].id : ''),
      slaveId: 1,
      protocolTemplateId: controlTemplates.value.length > 0 ? controlTemplates.value[0].id : '',
      description: ''
    });
  }
  devDialogVisible.value = true;
};

const saveDeviceForm = async () => {
  if (!editingDev.name || !editingDev.gatewayId || !editingDev.protocolTemplateId) {
    ElMessage.warning('请完整填写设备名称、归属网关和控制协议模板');
    return;
  }
  savingDev.value = true;
  try {
    await api.saveDevice(editingDev);
    ElMessage.success('受控从站已保存');
    devDialogVisible.value = false;
    await loadData();
    await store.refreshAll();
  } catch (e: any) {
    ElMessage.error('保存设备失败: ' + e.message);
  } finally {
    savingDev.value = false;
  }
};

const handleDeleteDevice = (dev: ControlledDevice) => {
  ElMessageBox.confirm(`确定删除受控从站设备 [${dev.name}] 吗？`, '删除确认', { type: 'warning' }).then(async () => {
    try {
      await api.deleteDevice(dev.id);
      ElMessage.success('从站设备已删除');
      await loadData();
      await store.refreshAll();
    } catch (e: any) {
      ElMessage.error('删除失败: ' + e.message);
    }
  });
};

onMounted(async () => {
  await loadData();
  // 初次加载后立即静默探活一次
  gateways.value.forEach(gw => silentHeartbeatCheck(gw));
  startHeartbeatPolling();
});

onUnmounted(() => {
  stopHeartbeatPolling();
});
</script>

<style scoped>
.device-view-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.top-nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
}

.left-info h3 {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.left-info p {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.gateway-rows-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Gateway Single-Row Card */
.gateway-row-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.gateway-row-card:hover {
  border-color: var(--border-light);
}

.gw-main-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: #141c2b;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  user-select: none;
  flex-wrap: wrap;
  gap: 12px;
}

.gw-main-row:hover {
  background: #192336;
}

.gw-left-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.collapse-icon {
  font-size: 11px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
  display: inline-block;
  width: 14px;
}

.collapse-icon.expanded {
  transform: rotate(90deg);
}

.gw-status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.online {
  background: var(--accent-green);
  box-shadow: 0 0 6px var(--accent-green);
}

.status-indicator.offline {
  background: var(--accent-rose);
}

.gw-title {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
}

.meta-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.clickable-telemetry {
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  padding: 2px 4px;
}

.clickable-telemetry:hover {
  background: rgba(255, 255, 255, 0.04);
}

.clickable-telemetry:hover .meta-tag {
  border-color: var(--accent-cyan);
}

.meta-tag-count {
  background: rgba(6, 182, 212, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.3);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
}

.gw-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 4px;
}

.text-cyan {
  color: var(--accent-cyan);
}

.text-amber {
  color: var(--accent-amber);
}

.text-muted {
  color: var(--text-muted);
}

/* Subordinate Devices */
.subordinate-devices-wrapper {
  background: #0f172a;
}

.subordinate-table {
  padding: 10px 18px 16px 18px;
}

.dev-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sub-branch-icon {
  color: var(--accent-cyan);
  font-weight: bold;
}

.text-slate {
  color: #f1f5f9;
}

.empty-sub-devices {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 23, 42, 0.6);
  border-top: 1px dashed rgba(255, 255, 255, 0.05);
}

.empty-gateway-card {
  padding: 50px 20px;
  text-align: center;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.placeholder-icon {
  width: 48px;
  height: 48px;
  color: var(--border-light);
}

.input-tip {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  display: block;
}

/* Secondary Confirmation Dialog Styles */
.push-confirm-body {
  padding: 5px 0;
}

.push-warning-text {
  color: #f59e0b;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;
  line-height: 1.5;
}

.confirm-details-box {
  background: #0f172a;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .label {
  color: var(--text-muted);
}

.detail-row .value {
  color: var(--text-primary);
}

.param-summary-card {
  background: #1e293b;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 16px;
}

.param-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-cyan);
  margin-bottom: 10px;
}

.param-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.param-item {
  background: #0f172a;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.param-item .p-name {
  font-size: 11px;
  color: var(--text-muted);
}

.param-item .p-val {
  font-size: 13px;
  color: var(--accent-cyan);
}

.notice-callout {
  background: rgba(6, 182, 212, 0.1);
  border-left: 3px solid var(--accent-cyan);
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

/* Telemetry Diagnostics Modal Styles */
.telemetry-header-card {
  background: #1e293b;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  margin-bottom: 16px;
}

.gw-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.gw-title {
  font-size: 16px;
}

.telemetry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-card {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
}

.stat-value {
  font-size: 1.35rem;
  font-weight: 700;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-value .unit {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: normal;
}

.stat-tip {
  font-size: 11px;
  color: #64748b;
}

.dual-stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.02);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  margin-top: 4px;
}

.text-emerald { color: #10b981; }
.text-rose { color: #f43f5e; }
.text-violet { color: #8b5cf6; }
.text-indigo { color: #6366f1; }
.text-danger { color: #ef4444; }
.text-success { color: #10b981; }
</style>
