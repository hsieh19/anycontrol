<template>
  <div class="logs-view-container">
    <!-- Top Filter Bar -->
    <div class="filter-bar industrial-card">
      <div class="filter-controls">
        <div class="filter-item">
          <span class="label">操作员：</span>
          <el-input 
            v-model="filters.operator" 
            placeholder="搜索操作员姓名..." 
            clearable 
            size="small" 
            style="width: 160px"
          />
        </div>

        <div class="filter-item">
          <span class="label">执行状态：</span>
          <el-select v-model="filters.status" placeholder="全部状态" clearable size="small" style="width: 130px">
            <el-option label="全部状态" value="" />
            <el-option label="成功 (SUCCESS)" value="SUCCESS" />
            <el-option label="失败 (FAILED)" value="FAILED" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">关键字：</span>
          <el-input 
            v-model="filters.keyword" 
            placeholder="搜索设备/点位/寄存器..." 
            clearable 
            size="small" 
            style="width: 200px"
          />
        </div>

        <el-button type="primary" size="small" @click="fetchLogs">
          查询过滤
        </el-button>
        <el-button size="small" @click="resetFilters">
          重置
        </el-button>
      </div>

      <div class="right-actions">
        <div class="ws-status-badge" :class="{ connected: store.wsConnected }">
          <span class="ws-pulse"></span>
          <span>{{ store.wsConnected ? '实时 WebSocket 审计流已同步' : 'WebSocket 连接中...' }}</span>
        </div>

        <el-button type="success" plain size="small" @click="exportCSV">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          导出 CSV
        </el-button>

        <el-button type="danger" plain size="small" @click="handleClearLogs">
          清空日志
        </el-button>
      </div>
    </div>

    <!-- Logs Table Card -->
    <div class="logs-card industrial-card">
      <el-table 
        :data="filteredLogs" 
        stripe 
        style="width: 100%" 
        height="calc(100vh - 200px)"
        :row-class-name="tableRowClassName"
      >
        <el-table-column prop="timestamp" label="操作时间" width="180">
          <template #default="{ row }">
            <span class="font-mono text-xs">{{ formatTime(row.timestamp) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="operator" label="操作员" width="160">
          <template #default="{ row }">
            <span class="font-semibold">{{ row.operator }}</span>
          </template>
        </el-table-column>

        <el-table-column label="目标设备与网关" min-width="240">
          <template #default="{ row }">
            <div class="target-dev-cell">
              <span class="font-semibold">{{ row.deviceName }} (从站 {{ row.slaveId }})</span>
              <span class="gw-sub text-muted font-mono">
                {{ row.gatewayName }} <span class="gw-ip-text">({{ row.gatewayIp || getGatewayIp(row.gatewayId) || '-' }})</span>
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="控制点位 / 寄存器" min-width="180">
          <template #default="{ row }">
            <div class="point-cell">
              <span class="text-cyan font-semibold">{{ row.pointName }}</span>
              <span class="addr-sub font-mono text-muted">Addr: {{ row.address }} (FC 0{{ row.functionCode }})</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="previousValue" label="修改前原始值" width="130">
          <template #default="{ row }">
            <span class="font-mono text-muted-val" v-if="row.previousValue !== null && row.previousValue !== undefined">
              {{ formatLogVal(row.previousValue) }}
            </span>
            <span v-else class="text-muted font-mono">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="value" label="下发写入值" width="130">
          <template #default="{ row }">
            <span class="font-mono font-bold text-amber">{{ formatLogVal(row.value) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="readbackValue" label="闭环回读值" width="130">
          <template #default="{ row }">
            <span class="font-mono text-emerald" v-if="row.readbackValue !== null && row.readbackValue !== undefined">
              {{ formatLogVal(row.readbackValue) }}
            </span>
            <span v-else class="text-muted font-mono">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="executionTimeMs" label="耗时" width="90">
          <template #default="{ row }">
            <span class="font-mono text-xs" v-if="row.executionTimeMs !== undefined">{{ row.executionTimeMs }}ms</span>
            <span v-else>-</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="执行状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'SUCCESS' ? 'success' : 'danger'" size="small">
              {{ row.status === 'SUCCESS' ? '成功 SUCCESS' : '失败 FAILED' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="errorMsg" label="校验详情 / 错误日志" min-width="220">
          <template #default="{ row }">
            <span v-if="row.errorMsg" class="error-text font-mono">{{ row.errorMsg }}</span>
            <span v-else-if="row.status === 'SUCCESS'" class="success-text">物理状态回读匹配，总线应答正常</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useAppStore } from '../stores/appStore';
import { AuditLog } from '../types';
import * as api from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';

const store = useAppStore();

const filters = reactive({
  operator: '',
  status: '',
  keyword: ''
});

const logs = ref<AuditLog[]>([]);

const fetchLogs = async () => {
  try {
    const data = await api.getAuditLogs({
      operator: filters.operator || undefined,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined,
      limit: 300
    });
    logs.value = data;
  } catch (e: any) {
    ElMessage.error('加载日志失败: ' + e.message);
  }
};

const resetFilters = () => {
  filters.operator = '';
  filters.status = '';
  filters.keyword = '';
  fetchLogs();
};

const getGatewayIp = (gwId: string) => {
  const gw = store.deviceTree.find(g => g.id === gwId);
  if (gw) {
    return `${gw.ip}:${gw.port || 502}`;
  }
  return '';
};

const filteredLogs = computed(() => {
  let list = logs.value;
  if (store.auditLogs.length > 0 && !filters.operator && !filters.status && !filters.keyword) {
    list = store.auditLogs;
  }
  const seen = new Set<number>();
  return list.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
});

const formatTime = (ts: string) => {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { hour12: false });
};

const formatLogVal = (val: any) => {
  if (typeof val === 'boolean') {
    return val ? 'TRUE (1)' : 'FALSE (0)';
  }
  return val;
};

const tableRowClassName = ({ row }: { row: AuditLog }) => {
  if (row.isNew) return 'highlight-new-row';
  return '';
};

// Export to CSV
const exportCSV = () => {
  if (filteredLogs.value.length === 0) {
    ElMessage.warning('暂无可导出的操作日志');
    return;
  }

  const headers = ['ID', '时间', '操作员', '网关', '网关IP地址', '设备名称', '从站ID', '点位名称', '点位Key', '功能码', '寄存器地址', '修改前原始值', '本次下发值', '闭环回读值', '耗时(ms)', '状态', '错误信息'];
  const rows = filteredLogs.value.map(l => [
    l.id,
    `"${l.timestamp}"`,
    `"${l.operator}"`,
    `"${l.gatewayName}"`,
    `"${l.gatewayIp || getGatewayIp(l.gatewayId) || ''}"`,
    `"${l.deviceName}"`,
    l.slaveId,
    `"${l.pointName}"`,
    `"${l.pointKey}"`,
    l.functionCode,
    l.address,
    typeof l.previousValue === 'boolean' ? (l.previousValue ? 1 : 0) : (l.previousValue ?? ''),
    typeof l.value === 'boolean' ? (l.value ? 1 : 0) : l.value,
    typeof l.readbackValue === 'boolean' ? (l.readbackValue ? 1 : 0) : (l.readbackValue ?? ''),
    l.executionTimeMs ?? '',
    l.status,
    `"${(l.errorMsg || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Modbus_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  ElMessage.success('已导出 CSV 审计日志');
};

const handleClearLogs = () => {
  ElMessageBox.confirm('确定清空所有操作与审计日志吗？此操作不可逆！', '高危操作确认', { type: 'warning' }).then(async () => {
    try {
      await api.clearAuditLogs();
      store.auditLogs = [];
      logs.value = [];
      ElMessage.success('审计日志已全部清空');
    } catch (e: any) {
      ElMessage.error('清空日志失败: ' + e.message);
    }
  });
};

onMounted(() => {
  fetchLogs();
});
</script>

<style scoped>
.logs-view-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-item .label {
  font-size: 13px;
  color: var(--text-muted);
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ws-status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: rgba(244, 63, 94, 0.15);
  border: 1px solid rgba(244, 63, 94, 0.3);
  border-radius: 20px;
  font-size: 12px;
  color: #fb7185;
}

.ws-status-badge.connected {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.3);
  color: #34d399;
}

.ws-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
}

.icon-sm {
  width: 14px;
  height: 14px;
  margin-right: 4px;
}

.logs-card {
  padding: 16px;
}

.target-dev-cell, .point-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gw-sub, .addr-sub {
  font-size: 11px;
}

.text-cyan {
  color: var(--accent-cyan);
}

.text-emerald {
  color: #34d399;
}

.text-amber {
  color: #fbbf24;
}

.text-muted-val {
  color: #94a3b8;
}

.gw-ip-text {
  color: #38bdf8;
}

.text-muted {
  color: var(--text-muted);
}

.error-text {
  color: var(--accent-rose);
  font-size: 12px;
}

.success-text {
  color: #10b981;
  font-size: 12px;
}

:deep(.highlight-new-row) {
  animation: flashNew 2s ease-out;
}

@keyframes flashNew {
  0% {
    background-color: rgba(6, 182, 212, 0.3) !important;
  }
  100% {
    background-color: transparent !important;
  }
}
</style>
