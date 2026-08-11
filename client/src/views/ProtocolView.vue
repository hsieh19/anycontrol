<template>
  <div class="protocol-view-container">
    <!-- Main Content: Left Template List + Right Points & Comm Table -->
    <div class="protocol-layout">
      <!-- Left: Template List Panel -->
      <div class="tpl-list-panel industrial-card">
        <div class="panel-head">
          <span class="font-semibold">协议模板列表</span>
          <span class="text-muted text-xs">{{ controlTemplates.length }} 个模板</span>
        </div>

        <div class="tpl-items">
          <div 
            v-for="tpl in controlTemplates" 
            :key="tpl.id"
            class="tpl-item"
            :class="{ active: selectedTpl?.id === tpl.id }"
            @click="selectedTpl = tpl"
          >
            <div class="tpl-item-title">{{ tpl.name }}</div>
            <div class="tpl-item-meta">
              <span class="text-cyan font-semibold">{{ tpl.points.length }} 个控制点位</span>
              <span class="meta-desc text-muted">{{ tpl.description || '无描述' }}</span>
            </div>
          </div>

          <div v-if="controlTemplates.length === 0" class="empty-tpl-list">
            暂无协议模板，请点击右上角「+ 新增协议模板」
          </div>
        </div>
      </div>

      <!-- Right: Points Table & Editor Panel -->
      <div v-if="selectedTpl" class="tpl-detail-panel industrial-card">
        <div class="detail-head">
          <div class="head-left">
            <div class="title-row">
              <h2>{{ selectedTpl.name }}</h2>
              <el-tag size="small" type="primary">
                {{ selectedTpl.points.length }} 个控制点位
              </el-tag>
            </div>
            <span class="desc-text">{{ selectedTpl.description || '无补充说明' }}</span>
          </div>

          <!-- Buttons Group: 添加控制点位 + 编辑模板 + 删除模板 -->
          <div class="head-right">
            <el-button type="success" size="default" @click="openPointDialog()">
              <svg class="icon-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              添加控制点位
            </el-button>

            <el-button type="primary" plain size="default" @click="openTplDialog(selectedTpl)">
              编辑模板名称
            </el-button>

            <el-button type="danger" plain size="default" @click="handleDeleteTpl(selectedTpl)">
              删除模板
            </el-button>
          </div>
        </div>

        <!-- Points Table -->
        <div class="points-table-container">
          <el-table :data="selectedTpl.points" stripe style="width: 100%">
            <el-table-column prop="name" label="点位名称" min-width="150">
              <template #default="{ row }">
                <div class="pt-name-cell">
                  <span class="font-semibold">{{ row.name }}</span>
                  <span class="pt-key-sub font-mono">{{ row.key }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="Modbus 功能码" width="160">
              <template #default="{ row }">
                <el-tag size="small" :type="getFcTagType(row.functionCode)">
                  {{ getFcLabel(row.functionCode) }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column prop="address" label="寄存器地址" width="120">
              <template #default="{ row }">
                <span class="font-mono text-cyan font-semibold">{{ row.address }}</span>
              </template>
            </el-table-column>

            <el-table-column prop="dataType" label="数据类型" width="110">
              <template #default="{ row }">
                <el-tag size="small" type="info">{{ row.dataType }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column prop="registerCount" label="寄存器数量" width="100">
              <template #default="{ row }">
                <span class="font-mono">{{ row.registerCount }} 寄存器</span>
              </template>
            </el-table-column>

            <el-table-column label="倍率 / 单位" width="110">
              <template #default="{ row }">
                <span class="font-mono">{{ row.scale || 1 }} / {{ row.unit || '-' }}</span>
              </template>
            </el-table-column>

            <el-table-column prop="permission" label="权限" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.permission === 'RW' ? 'success' : row.permission === 'RO' ? 'info' : 'warning'">
                  {{ row.permission }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click="openPointDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" link @click="handleDeletePoint(row)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div v-else class="empty-selection industrial-card">
        <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        <p>请在左侧选择一个协议模板，或点击右上角「+ 新增协议模板」开始配置点位与通讯参数</p>
      </div>
    </div>

    <!-- Template Name/Desc Edit Dialog -->
    <el-dialog
      v-model="tplDialogVisible"
      :title="editingTpl.id ? '编辑协议模板' : '新增协议模板'"
      width="480px"
    >
      <el-form label-width="120px">
        <el-form-item label="模板名称" required>
          <el-input v-model="editingTpl.name" placeholder="例如: 变频器标准控制模板 / 空调控制模板" />
        </el-form-item>
        <el-form-item label="模板描述">
          <el-input v-model="editingTpl.description" type="textarea" :rows="3" placeholder="适用设备型号与点位功能说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tplDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingTpl" @click="saveTemplateForm">保存模板</el-button>
      </template>
    </el-dialog>

    <!-- Point Edit Dialog (左右双栏并排，无滚动条紧凑布局) -->
    <el-dialog
      v-model="pointDialogVisible"
      :title="editingPoint.id ? '编辑控制点位' : '新增控制点位'"
      width="960px"
      top="6vh"
      class="point-modal-custom"
    >
      <div class="point-dialog-two-col">
        <!-- Left Col: Form Configuration -->
        <div class="point-col-left">
          <div class="section-badge-title">📋 点位参数配置</div>
          
          <el-form label-position="top" class="point-compact-form">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="点位名称" required>
                  <el-input v-model="editingPoint.name" placeholder="例如: 设定回风温度" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="英文标识 Key" required>
                  <el-input v-model="editingPoint.key" placeholder="例如: set_temp" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="寄存器类型与功能码" required>
              <el-select v-model="editingPoint.functionCode" style="width: 100%" @change="handleFcChange">
                <el-option :value="6" label="保持寄存器 4x (读0x03 / 单字写0x06) - 标准数值读写" />
                <el-option :value="16" label="保持寄存器 4x (读0x03 / 连续写0x10) - 32位或多字写" />
                <el-option :value="5" label="线圈 0x (读0x01 / 写0x05) - 开关量启停读写" />
                <el-option :value="15" label="线圈 0x (读0x01 / 写0x0F) - 连续写多个线圈" />
                <el-option :value="4" label="输入寄存器 3x (读0x04) - 仅只读测量数值" />
                <el-option :value="2" label="离散输入 1x (读0x02) - 仅只读开关状态" />
                <el-option :value="3" label="保持寄存器 (纯读0x03) - 仅只读监控" />
                <el-option :value="1" label="线圈 (纯读0x01) - 仅只读状态监控" />
              </el-select>
            </el-form-item>

            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="起始地址 (Dec)" required>
                  <el-input-number v-model="editingPoint.address" :min="0" :max="65535" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="数据类型" required>
                  <el-select v-model="editingPoint.dataType" style="width: 100%" @change="handleDataTypeChange">
                    <el-option label="FLOAT32 (单精度浮点)" value="FLOAT32" />
                    <el-option label="UINT16 (16位无符号)" value="UINT16" />
                    <el-option label="INT16 (16位有符号)" value="INT16" />
                    <el-option label="UINT32 (32位无符号)" value="UINT32" />
                    <el-option label="INT32 (32位有符号)" value="INT32" />
                    <el-option label="BOOLEAN (开关量/线圈)" value="BOOLEAN" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>

            <!-- 32-bit Byte Order Mode Selector -->
            <el-row :gutter="12" v-if="['FLOAT32', 'UINT32', 'INT32'].includes(editingPoint.dataType || '')">
              <el-col :span="12">
                <el-form-item label="32位字节序 (Byte Order)" required>
                  <el-select v-model="editingPoint.byteOrder" style="width: 100%">
                    <el-option label="ABCD (大端序 Big-Endian)" value="ABCD" />
                    <el-option label="CDAB (字反转 Word-Swap / Modicon)" value="CDAB" />
                    <el-option label="BADC (字节反转 Byte-Swap)" value="BADC" />
                    <el-option label="DCBA (小端序 Little-Endian)" value="DCBA" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="寄存器数量 (自动)">
                  <el-input-number v-model="editingPoint.registerCount" :min="1" :max="4" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12" v-else>
              <el-col :span="12">
                <el-form-item label="寄存器数量">
                  <el-input-number v-model="editingPoint.registerCount" :min="1" :max="4" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="倍率 (Scale)">
                  <el-input-number v-model="editingPoint.scale" :min="0.0001" :max="1000" :step="0.1" :precision="4" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12" v-if="['FLOAT32', 'UINT32', 'INT32'].includes(editingPoint.dataType || '')">
              <el-col :span="12">
                <el-form-item label="倍率 (Scale)">
                  <el-input-number v-model="editingPoint.scale" :min="0.0001" :max="1000" :step="0.1" :precision="4" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="工程单位">
                  <el-input v-model="editingPoint.unit" placeholder="例如: ℃, Hz, MPa, %" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12" v-if="!['FLOAT32', 'UINT32', 'INT32'].includes(editingPoint.dataType || '')">
              <el-col :span="10">
                <el-form-item label="工程单位">
                  <el-input v-model="editingPoint.unit" placeholder="例如: ℃, Hz, %" />
                </el-form-item>
              </el-col>
              <el-col :span="14">
                <el-form-item label="访问权限 (ACL)" required>
                  <el-radio-group v-model="editingPoint.permission" size="default">
                    <el-radio value="RW">读写 (RW)</el-radio>
                    <el-radio value="RO">只读 (RO)</el-radio>
                    <el-radio value="WO">只写 (WO)</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12" v-if="['FLOAT32', 'UINT32', 'INT32'].includes(editingPoint.dataType || '')">
              <el-col :span="24">
                <el-form-item label="访问权限 (ACL)" required>
                  <el-radio-group v-model="editingPoint.permission" size="default">
                    <el-radio value="RW">读写 (RW)</el-radio>
                    <el-radio value="RO">只读 (RO)</el-radio>
                    <el-radio value="WO">只写 (WO)</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </div>

        <!-- Right Col: Live Packet Inspector -->
        <div class="point-col-right">
          <div class="section-badge-title">⚡ Modbus 实时报文校验</div>

          <!-- Top Toolbar for Sim Inputs with ample width -->
          <div class="sim-toolbar-card">
            <div class="sim-field-item">
              <span class="sim-label">从站 ID:</span>
              <el-input-number v-model="sampleSlaveId" :min="1" :max="247" size="small" style="width: 88px" />
            </div>
            <div class="sim-field-item" v-if="editingPoint.permission !== 'RO'">
              <span class="sim-label">模拟测试值:</span>
              <el-input-number 
                v-if="editingPoint.dataType !== 'BOOLEAN'"
                v-model="sampleValueNum" 
                :step="editingPoint.dataType === 'FLOAT32' ? 0.1 : 1"
                :precision="editingPoint.dataType === 'FLOAT32' ? 2 : 0"
                size="small" 
                style="width: 110px" 
              />
              <el-switch 
                v-else
                v-model="sampleValueBool"
                size="small"
                active-text="ON"
                inactive-text="OFF"
              />
            </div>
          </div>

          <div class="packet-preview-container">
            <!-- Read Packet Box -->
            <div class="frame-box read-frame" v-if="editingPoint.permission !== 'WO'">
              <div class="frame-tag-title">
                <span class="badge-read">读指令 (Read Request)</span>
                <span class="frame-tip font-mono">Hex: 0x{{ (Number(editingPoint.address) || 0).toString(16).padStart(4, '0').toUpperCase() }}</span>
              </div>
              <div class="hex-display font-mono">
                {{ readPacketInfo.hexStr }}
              </div>
              <div class="frame-breakdown">
                <div 
                  v-for="(b, idx) in readPacketInfo.breakdown" 
                  :key="idx" 
                  class="byte-chip chip-blue"
                  :title="b.tip"
                >
                  <span class="chip-hex font-mono">{{ b.hex }}</span>
                  <span class="chip-label">{{ b.label }}</span>
                </div>
              </div>
            </div>

            <!-- Write Packet Box -->
            <div class="frame-box write-frame" v-if="editingPoint.permission !== 'RO'">
              <div class="frame-tag-title">
                <span class="badge-write">写指令 (Write Request)</span>
                <span class="frame-tip font-mono">
                  {{ editingPoint.dataType === 'BOOLEAN' ? (sampleValueBool ? 'ON (0xFF00)' : 'OFF (0x0000)') : `下发: ${sampleValueNum}` }}
                  <span v-if="['FLOAT32', 'UINT32', 'INT32'].includes(editingPoint.dataType || '')" class="byte-order-badge">
                    [{{ editingPoint.byteOrder || 'ABCD' }}]
                  </span>
                </span>
              </div>
              <div class="hex-display font-mono">
                {{ writePacketInfo.hexStr }}
              </div>
              <div class="frame-breakdown">
                <div 
                  v-for="(b, idx) in writePacketInfo.breakdown" 
                  :key="idx" 
                  class="byte-chip chip-orange"
                  :title="b.tip"
                >
                  <span class="chip-hex font-mono">{{ b.hex }}</span>
                  <span class="chip-label">{{ b.label }}</span>
                </div>
              </div>
            </div>

            <!-- Helper Prompt -->
            <div class="perm-helper-card">
              <div class="helper-text">
                <span v-if="editingPoint.permission === 'RW'" class="text-success">
                  💡 <b>读写 (RW)</b>：控制台定时通过 0x03/0x01 回读物理值，并提供操作控件允许下发控制。
                </span>
                <span v-else-if="editingPoint.permission === 'RO'" class="text-cyan">
                  💡 <b>只读 (RO)</b>：仅供采集监控（如传感器测量值），控制台禁止下发修改指令。
                </span>
                <span v-else class="text-amber">
                  💡 <b>只写 (WO)</b>：动作触发点位（如复位/点动），不回读显示日常数值。
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="pointDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePointForm">保存点位配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useAppStore } from '../stores/appStore';
import { ControlProtocolTemplate, ControlPoint, FunctionCode, ByteOrder } from '../types';
import * as api from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';

const store = useAppStore();

// 监听顶栏 "+ 新增协议模板" 触发事件
watch(() => store.openAddProtocolEvent, () => {
  openTplDialog();
});

const controlTemplates = ref<ControlProtocolTemplate[]>([]);
const selectedTpl = ref<ControlProtocolTemplate | null>(null);

// Template Modal
const tplDialogVisible = ref(false);
const savingTpl = ref(false);
const editingTpl = reactive<Partial<ControlProtocolTemplate>>({
  name: '',
  description: '',
  points: []
});

// Point Modal
const pointDialogVisible = ref(false);
const editingPoint = reactive<Partial<ControlPoint>>({
  name: '',
  key: '',
  functionCode: 6,
  address: 0,
  dataType: 'UINT16',
  registerCount: 1,
  byteOrder: 'ABCD',
  scale: 1,
  unit: '',
  permission: 'RW'
});

// 报文模拟测试输入参数
const sampleSlaveId = ref(1);
const sampleValueNum = ref(25);
const sampleValueBool = ref(true);

const toHex = (num: number, byteCount: number = 1): string => {
  const n = Math.max(0, Math.min(0xffffffff, Math.floor(num || 0)));
  return n.toString(16).padStart(byteCount * 2, '0').toUpperCase();
};

// 浮点数 IEEE 754 转 4 字节按字节序排列
const float32ToHexBytes = (val: number, order: ByteOrder = 'ABCD'): string[] => {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, Number(val) || 0, false); // 大端字节 [A, B, C, D]
  const a = toHex(view.getUint8(0), 1);
  const b = toHex(view.getUint8(1), 1);
  const c = toHex(view.getUint8(2), 1);
  const d = toHex(view.getUint8(3), 1);

  switch (order) {
    case 'CDAB': return [c, d, a, b]; // Word-Swap
    case 'BADC': return [b, a, d, c]; // Byte-Swap
    case 'DCBA': return [d, c, b, a]; // Little-Endian
    case 'ABCD':
    default:
      return [a, b, c, d]; // Big-Endian
  }
};

// 32位整型转 4 字节按字节序排列
const int32ToHexBytes = (val: number, order: ByteOrder = 'ABCD'): string[] => {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, (Number(val) || 0) >>> 0, false);
  const a = toHex(view.getUint8(0), 1);
  const b = toHex(view.getUint8(1), 1);
  const c = toHex(view.getUint8(2), 1);
  const d = toHex(view.getUint8(3), 1);

  switch (order) {
    case 'CDAB': return [c, d, a, b];
    case 'BADC': return [b, a, d, c];
    case 'DCBA': return [d, c, b, a];
    case 'ABCD':
    default:
      return [a, b, c, d];
  }
};

const handleFcChange = (fc: number) => {
  if (fc === 2 || fc === 4 || fc === 1 || fc === 3) {
    editingPoint.permission = 'RO';
  } else if (fc === 5 || fc === 6 || fc === 15 || fc === 16) {
    if (editingPoint.permission === 'RO') {
      editingPoint.permission = 'RW';
    }
  }
  if (fc === 5 || fc === 15 || fc === 1 || fc === 2) {
    editingPoint.dataType = 'BOOLEAN';
    editingPoint.registerCount = 1;
  } else if (editingPoint.dataType === 'BOOLEAN') {
    editingPoint.dataType = 'UINT16';
  }
};

const handleDataTypeChange = (dt: string) => {
  if (dt === 'BOOLEAN') {
    editingPoint.functionCode = 5;
    editingPoint.registerCount = 1;
  } else if (dt === 'FLOAT32') {
    editingPoint.registerCount = 2;
    editingPoint.functionCode = 16;
    if (!editingPoint.byteOrder) editingPoint.byteOrder = 'ABCD';
  } else if (dt === 'UINT32' || dt === 'INT32') {
    editingPoint.registerCount = 2;
    editingPoint.functionCode = 16;
    if (!editingPoint.byteOrder) editingPoint.byteOrder = 'ABCD';
  } else {
    editingPoint.registerCount = 1;
    if (editingPoint.functionCode === 16) {
      editingPoint.functionCode = 6;
    }
  }
};

// 实时生成 Modbus TCP 读取报文
const readPacketInfo = computed(() => {
  const fc = editingPoint.functionCode || 6;
  let readFc = 3;
  if (fc === 1 || fc === 5 || fc === 15) readFc = 1;
  else if (fc === 2) readFc = 2;
  else if (fc === 4) readFc = 4;
  else readFc = 3;

  const slave = Number(sampleSlaveId.value) || 1;
  const addr = Number(editingPoint.address) || 0;
  const count = Number(editingPoint.registerCount) || (editingPoint.dataType === 'FLOAT32' ? 2 : 1);

  const addrHex = toHex(addr, 2);
  const countHex = toHex(count, 2);

  const hexBytes = [
    '00', '01',
    '00', '00',
    '00', '06',
    toHex(slave, 1),
    toHex(readFc, 1),
    addrHex.slice(0, 2), addrHex.slice(2, 4),
    countHex.slice(0, 2), countHex.slice(2, 4)
  ];

  return {
    hexStr: hexBytes.join(' '),
    breakdown: [
      { label: '事务元', hex: '00 01', tip: 'Transaction ID (2B)' },
      { label: '协议ID', hex: '00 00', tip: 'Modbus TCP 协议栈 (0x0000)' },
      { label: '长度', hex: '00 06', tip: '后续字节长度 (6 字节)' },
      { label: '从站ID', hex: toHex(slave, 1), tip: `Unit/Slave ID = ${slave}` },
      { label: '功能码', hex: toHex(readFc, 1), tip: `FC 0x0${readFc} (${readFc === 1 ? 'Read Coils' : readFc === 2 ? 'Read Discrete' : readFc === 4 ? 'Read Input' : 'Read Holding'})` },
      { label: '起始地址', hex: `${addrHex.slice(0, 2)} ${addrHex.slice(2, 4)}`, tip: `寄存器地址 Dec ${addr} (Hex 0x${addrHex})` },
      { label: '数量', hex: `${countHex.slice(0, 2)} ${countHex.slice(2, 4)}`, tip: `读取 ${count} 个寄存器/位` }
    ]
  };
});

// 实时生成 Modbus TCP 写入报文
const writePacketInfo = computed(() => {
  const fc = editingPoint.functionCode || 6;
  const slave = Number(sampleSlaveId.value) || 1;
  const addr = Number(editingPoint.address) || 0;
  const isBool = editingPoint.dataType === 'BOOLEAN' || fc === 5 || fc === 15;
  const isFloat = editingPoint.dataType === 'FLOAT32';
  const is32Int = editingPoint.dataType === 'UINT32' || editingPoint.dataType === 'INT32';
  const scale = editingPoint.scale || 1;
  const byteOrder = editingPoint.byteOrder || 'ABCD';
  const addrHex = toHex(addr, 2);

  if (isBool) {
    const boolOn = sampleValueBool.value;
    const valHex = boolOn ? 'FF 00' : '00 00';
    const hexBytes = [
      '00', '02', '00', '00', '00', '06',
      toHex(slave, 1),
      '05',
      addrHex.slice(0, 2), addrHex.slice(2, 4),
      valHex.slice(0, 2), valHex.slice(3, 5)
    ];
    return {
      hexStr: hexBytes.join(' '),
      breakdown: [
        { label: '事务元', hex: '00 02', tip: 'Transaction ID' },
        { label: '协议ID', hex: '00 00', tip: 'Modbus TCP' },
        { label: '长度', hex: '00 06', tip: '6 字节' },
        { label: '从站ID', hex: toHex(slave, 1), tip: `Slave ID = ${slave}` },
        { label: '功能码', hex: '05', tip: '0x05 Write Single Coil' },
        { label: '目标地址', hex: `${addrHex.slice(0, 2)} ${addrHex.slice(2, 4)}`, tip: `线圈地址 Dec ${addr}` },
        { label: '开关值', hex: valHex, tip: boolOn ? '置位 ON (0xFF00)' : '复位 OFF (0x0000)' }
      ]
    };
  }

  if (isFloat || is32Int || fc === 16) {
    // FC 16 (0x10) Write Multiple Registers (例如 32位 2个寄存器 4字节)
    let payloadBytes: string[] = [];
    let tipDetail = '';
    const regCount = Number(editingPoint.registerCount) || 2;
    const byteCount = regCount * 2;

    if (isFloat) {
      const floatVal = Number(sampleValueNum.value || 0) / scale;
      payloadBytes = float32ToHexBytes(floatVal, byteOrder);
      tipDetail = `FLOAT32: ${sampleValueNum.value} (${byteOrder})`;
    } else if (is32Int) {
      const intVal = Math.round(Number(sampleValueNum.value || 0) / scale);
      payloadBytes = int32ToHexBytes(intVal, byteOrder);
      tipDetail = `INT32: ${sampleValueNum.value} (${byteOrder})`;
    } else {
      const rawVal = Math.round(Number(sampleValueNum.value || 0) / scale);
      const h = toHex(rawVal, 2);
      payloadBytes = [h.slice(0, 2), h.slice(2, 4), '00', '00'];
      tipDetail = `值: ${sampleValueNum.value}`;
    }

    const lengthHex = toHex(7 + byteCount, 2); // UnitID(1) + FC(1) + Addr(2) + RegCount(2) + ByteCount(1) + Data(N)
    const countHex = toHex(regCount, 2);
    const byteCountHex = toHex(byteCount, 1);

    const hexBytes = [
      '00', '02', '00', '00',
      lengthHex.slice(0, 2), lengthHex.slice(2, 4),
      toHex(slave, 1),
      '10',
      addrHex.slice(0, 2), addrHex.slice(2, 4),
      countHex.slice(0, 2), countHex.slice(2, 4),
      byteCountHex,
      ...payloadBytes
    ];

    return {
      hexStr: hexBytes.join(' '),
      breakdown: [
        { label: '事务元', hex: '00 02', tip: 'Transaction ID' },
        { label: '协议ID', hex: '00 00', tip: 'Modbus TCP' },
        { label: '长度', hex: `${lengthHex.slice(0, 2)} ${lengthHex.slice(2, 4)}`, tip: `${7 + byteCount} 字节` },
        { label: '从站ID', hex: toHex(slave, 1), tip: `Slave ID = ${slave}` },
        { label: '功能码', hex: '10', tip: '0x10 Write Multiple Registers' },
        { label: '起始地址', hex: `${addrHex.slice(0, 2)} ${addrHex.slice(2, 4)}`, tip: `寄存器地址 Dec ${addr}` },
        { label: '寄存器数', hex: `${countHex.slice(0, 2)} ${countHex.slice(2, 4)}`, tip: `${regCount} 个寄存器` },
        { label: '字节数', hex: byteCountHex, tip: `${byteCount} 字节` },
        { label: '数据载荷', hex: payloadBytes.join(' '), tip: tipDetail }
      ]
    };
  }

  // FC 06 Write Single Register
  const rawVal = Math.round(Number(sampleValueNum.value || 0) / scale);
  const h = toHex(rawVal, 2);
  const valHex = `${h.slice(0, 2)} ${h.slice(2, 4)}`;

  const hexBytes = [
    '00', '02', '00', '00', '00', '06',
    toHex(slave, 1),
    '06',
    addrHex.slice(0, 2), addrHex.slice(2, 4),
    valHex.slice(0, 2), valHex.slice(3, 5)
  ];

  return {
    hexStr: hexBytes.join(' '),
    breakdown: [
      { label: '事务元', hex: '00 02', tip: 'Transaction ID (2B)' },
      { label: '协议ID', hex: '00 00', tip: 'Modbus TCP (0x0000)' },
      { label: '长度', hex: '00 06', tip: '长度 6 字节' },
      { label: '从站ID', hex: toHex(slave, 1), tip: `Slave ID = ${slave}` },
      { label: '功能码', hex: '06', tip: 'FC 0x06 Write Single Register' },
      { label: '目标地址', hex: `${addrHex.slice(0, 2)} ${addrHex.slice(2, 4)}`, tip: `寄存器地址 Dec ${addr}` },
      { label: '下发数值', hex: valHex, tip: `写入数值 ${sampleValueNum.value} (原生值: ${rawVal})` }
    ]
  };
});

const loadData = async () => {
  try {
    const tpls = await api.getControlTemplates();
    controlTemplates.value = tpls;
    if (tpls.length > 0) {
      if (!selectedTpl.value) {
        selectedTpl.value = tpls[0];
      } else {
        selectedTpl.value = tpls.find(t => t.id === selectedTpl.value?.id) || tpls[0];
      }
    } else {
      selectedTpl.value = null;
    }
  } catch (e: any) {
    ElMessage.error('加载协议数据失败: ' + e.message);
  }
};



const getFcTagType = (fc: FunctionCode) => {
  switch (fc) {
    case 5: return 'success';
    case 6: return 'primary';
    case 15:
    case 16: return 'warning';
    default: return 'info';
  }
};

const getFcLabel = (fc: FunctionCode) => {
  switch (fc) {
    case 1: return '0x01 Read Coil';
    case 2: return '0x02 Read Discrete';
    case 3: return '0x03 Read Holding';
    case 4: return '0x04 Read Input';
    case 5: return '0x05 Write Coil';
    case 6: return '0x06 Write Register';
    case 15: return '0x0F Write Coils';
    case 16: return '0x10 Write Registers';
    default: return `FC 0${fc}`;
  }
};

// Template Modal Handlers
const openTplDialog = (tpl?: ControlProtocolTemplate) => {
  if (tpl) {
    Object.assign(editingTpl, tpl);
  } else {
    Object.assign(editingTpl, {
      id: undefined,
      name: '',
      description: '',
      points: []
    });
  }
  tplDialogVisible.value = true;
};

const saveTemplateForm = async () => {
  if (!editingTpl.name) {
    ElMessage.warning('请填写协议模板名称');
    return;
  }
  savingTpl.value = true;
  try {
    const saved = await api.saveControlTemplate(editingTpl);
    ElMessage.success('协议模板已保存');
    tplDialogVisible.value = false;
    await loadData();
    selectedTpl.value = saved;
    await store.refreshAll();
  } catch (e: any) {
    ElMessage.error('保存模板失败: ' + e.message);
  } finally {
    savingTpl.value = false;
  }
};

const handleDeleteTpl = (tpl: ControlProtocolTemplate) => {
  ElMessageBox.confirm(`确定删除模板 [${tpl.name}] 吗？将移除包含的所有点位与通讯配置。`, '删除确认', { type: 'warning' }).then(async () => {
    try {
      await api.deleteControlTemplate(tpl.id);
      ElMessage.success('模板已删除');
      selectedTpl.value = null;
      await loadData();
      await store.refreshAll();
    } catch (e: any) {
      ElMessage.error('删除失败: ' + e.message);
    }
  });
};

// Point Handlers
const openPointDialog = (pt?: ControlPoint) => {
  if (pt) {
    Object.assign(editingPoint, pt);
  } else {
    Object.assign(editingPoint, {
      id: undefined,
      name: '',
      key: '',
      functionCode: 6,
      address: (selectedTpl.value?.points.length || 0) * 1,
      dataType: 'UINT16',
      registerCount: 1,
      scale: 1,
      unit: '',
      permission: 'RW'
    });
  }
  pointDialogVisible.value = true;
};

const savePointForm = async () => {
  if (!selectedTpl.value) return;
  if (!editingPoint.name || !editingPoint.key || editingPoint.address === undefined) {
    ElMessage.warning('请完整填写点位名称、Key 标识和寄存器地址');
    return;
  }

  const pointList = [...selectedTpl.value.points];
  const pointId = editingPoint.id || `pt-${Date.now().toString(36)}`;

  const newPoint: ControlPoint = {
    id: pointId,
    name: editingPoint.name,
    key: editingPoint.key,
    functionCode: editingPoint.functionCode as FunctionCode,
    address: Number(editingPoint.address),
    dataType: editingPoint.dataType as any,
    registerCount: Number(editingPoint.registerCount) || 1,
    scale: Number(editingPoint.scale) || 1,
    unit: editingPoint.unit || '',
    permission: editingPoint.permission as any,
    defaultValue: editingPoint.dataType === 'BOOLEAN' ? false : 0
  };

  const idx = pointList.findIndex(p => p.id === pointId);
  if (idx >= 0) {
    pointList[idx] = newPoint;
  } else {
    pointList.push(newPoint);
  }

  selectedTpl.value.points = pointList;

  try {
    await api.saveControlTemplate(selectedTpl.value);
    ElMessage.success('点位配置已更新');
    pointDialogVisible.value = false;
    await loadData();
    await store.refreshAll();
  } catch (e: any) {
    ElMessage.error('保存点位失败: ' + e.message);
  }
};

const handleDeletePoint = (pt: ControlPoint) => {
  if (!selectedTpl.value) return;
  ElMessageBox.confirm(`确定移除点位 [${pt.name}] 吗？`, '移除确认', { type: 'warning' }).then(async () => {
    selectedTpl.value!.points = selectedTpl.value!.points.filter(p => p.id !== pt.id);
    try {
      await api.saveControlTemplate(selectedTpl.value!);
      ElMessage.success('点位已移除');
      await loadData();
      await store.refreshAll();
    } catch (e: any) {
      ElMessage.error('移除点位失败: ' + e.message);
    }
  });
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.protocol-view-container {
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

.protocol-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 100px);
}

.tpl-list-panel {
  width: 300px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 12px;
}

.tpl-items {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tpl-item {
  padding: 12px;
  background: #162032;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tpl-item:hover {
  background: #1e2c44;
  border-color: #3b4d66;
}

.tpl-item.active {
  background: #173456;
  border-color: var(--accent-cyan);
}

.tpl-item-title {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 4px;
}

.tpl-item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-muted);
}

.meta-desc {
  font-size: 11px;
}

.empty-tpl-list {
  padding: 24px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

.tpl-detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 16px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-row h2 {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
}

.desc-text {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
  display: block;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 14px;
  height: 14px;
  margin-right: 4px;
}

.points-table-container {
  flex: 1;
  overflow-y: auto;
}

.pt-name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pt-key-sub {
  font-size: 11px;
  color: var(--text-muted);
}

.input-tip {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: 12px;
}

.empty-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 12px;
  padding: 40px;
  text-align: center;
}

.placeholder-icon {
  width: 48px;
  height: 48px;
  color: var(--border-light);
}

/* Point Dialog 2-Column Zero-Scrollbar Layout */
.point-dialog-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}

.point-col-left {
  background: #111a29;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 16px 18px;
}

.point-col-right {
  background: #0c1421;
  border: 1px solid #1e293b;
  border-radius: var(--radius-sm);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-badge-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-cyan);
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
  margin-bottom: 8px;
}

.sim-toolbar-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #141f30;
  border: 1px solid #1e2e46;
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 6px;
}

.sim-field-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sim-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.byte-order-badge {
  color: #38bdf8;
  font-weight: 700;
  margin-left: 4px;
}

.point-compact-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.point-compact-form :deep(.el-form-item__label) {
  padding-bottom: 2px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.2;
}

.packet-preview-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.frame-box {
  background: #141f30;
  border: 1px solid #1e2e46;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.frame-tag-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.badge-read {
  font-size: 11px;
  font-weight: 700;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
  padding: 1px 6px;
  border-radius: 3px;
}

.badge-write {
  font-size: 11px;
  font-weight: 700;
  color: #fb923c;
  background: rgba(251, 146, 60, 0.15);
  padding: 1px 6px;
  border-radius: 3px;
}

.frame-tip {
  font-size: 11px;
  color: var(--text-muted);
}

.hex-display {
  font-size: 13px;
  font-weight: 700;
  color: #34d399;
  letter-spacing: 1.2px;
  background: #090e17;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid rgba(52, 211, 153, 0.2);
}

.frame-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.byte-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 9px;
}

.chip-blue {
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(14, 165, 233, 0.25);
}

.chip-orange {
  background: rgba(249, 115, 22, 0.12);
  border: 1px solid rgba(249, 115, 22, 0.25);
}

.chip-hex {
  font-size: 10px;
  font-weight: 700;
  color: #f8fafc;
}

.chip-label {
  color: var(--text-muted);
}

.perm-helper-card {
  background: #111a28;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 12px;
}

.helper-text {
  font-size: 11px;
  line-height: 1.4;
}
</style>
