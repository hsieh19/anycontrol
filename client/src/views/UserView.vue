<template>
  <div class="user-view-container">
    <!-- Users Table Card -->
    <div class="users-card industrial-card">
      <div class="card-toolbar">
        <div class="toolbar-left">
          <span class="font-semibold text-white">用户列表与权限配置</span>
          <span class="text-muted text-xs">共 {{ users.length }} 个账号</span>
        </div>
      </div>

      <el-table :data="users" stripe style="width: 100%">
        <el-table-column prop="name" label="姓名 / 账号" min-width="180">
          <template #default="{ row }">
            <div class="user-name-cell">
              <div class="user-avatar" :class="`role-${row.role.toLowerCase()}`">
                {{ row.name.charAt(0) }}
              </div>
              <div class="user-text">
                <span class="font-semibold">{{ row.name }}</span>
                <span class="username font-mono">@{{ row.username }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="role" label="角色身份" width="160">
          <template #default="{ row }">
            <el-tag :type="getRoleTagType(row.role)">
              {{ getRoleName(row.role) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="可访问的控制设备权限" min-width="260">
          <template #default="{ row }">
            <template v-if="row.role === 'ADMIN'">
              <el-tag size="small" type="success">全部设备 (无限制)</el-tag>
            </template>
            <template v-else-if="row.allowedDeviceIds && row.allowedDeviceIds.length > 0">
              <div class="device-tags">
                <el-tag 
                  v-for="devId in row.allowedDeviceIds" 
                  :key="devId" 
                  size="small" 
                  type="info"
                >
                  {{ getDeviceName(devId) }}
                </el-tag>
              </div>
            </template>
            <template v-else>
              <span class="text-muted text-xs">暂无授权设备</span>
            </template>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="账号状态" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'ACTIVE' ? 'success' : 'danger'">
              {{ row.status === 'ACTIVE' ? '正常启用' : '已冻结' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="openUserDialog(row)">编辑授权</el-button>
            <el-button 
              v-if="row.role !== 'ADMIN'" 
              size="small" 
              type="danger" 
              link 
              @click="handleDeleteUser(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- User Edit Dialog -->
    <el-dialog
      v-model="userDialogVisible"
      :title="editingUser.id ? '编辑用户与权限' : '新增用户账号'"
      width="560px"
    >
      <el-form label-width="120px">
        <el-form-item label="登录用户名" required>
          <el-input v-model="editingUser.username" placeholder="例如: operator_01" />
        </el-form-item>
        <el-form-item label="真实姓名" required>
          <el-input v-model="editingUser.name" placeholder="例如: 李工 (动力站操作员)" />
        </el-form-item>
        <el-form-item label="角色权限" required>
          <el-select v-model="editingUser.role" style="width: 100%">
            <el-option label="系统管理员 (ADMIN - 拥有全部权限)" value="ADMIN" />
            <el-option label="现场操作员 (OPERATOR - 允许下发已授权设备)" value="OPERATOR" />
            <el-option label="安全审计员 (AUDITOR - 审计日志分析与监督)" value="AUDITOR" />
            <el-option label="只读观察员 (VIEWER - 仅允许查看状态)" value="VIEWER" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editingUser.role !== 'ADMIN'" label="可控制设备">
          <div class="checkbox-group-container">
            <el-checkbox-group v-model="editingUser.allowedDeviceIds">
              <div v-for="dev in allDevices" :key="dev.id" class="checkbox-row">
                <el-checkbox :value="dev.id">
                  <span class="font-semibold">{{ dev.name }}</span>
                  <span class="text-muted text-xs"> (Slave {{ dev.slaveId }} - {{ getGatewayName(dev.gatewayId) }})</span>
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </el-form-item>
        <el-form-item label="账号状态">
          <el-radio-group v-model="editingUser.status">
            <el-radio value="ACTIVE">正常启用</el-radio>
            <el-radio value="DISABLED">暂停冻结</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingUser" @click="saveUserForm">保存用户配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue';
import { useAppStore } from '../stores/appStore';
import { User, ControlledDevice, Gateway, UserRole } from '../types';
import * as api from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';

const store = useAppStore();

// 监听顶栏 "+ 新增用户账号" 触发事件
watch(() => store.openAddUserEvent, () => {
  openUserDialog();
});

const users = ref<User[]>([]);
const allDevices = ref<ControlledDevice[]>([]);
const allGateways = ref<Gateway[]>([]);

const userDialogVisible = ref(false);
const savingUser = ref(false);
const editingUser = reactive<Partial<User>>({
  username: '',
  name: '',
  role: 'OPERATOR',
  allowedDeviceIds: [],
  status: 'ACTIVE'
});

const loadData = async () => {
  try {
    const [uList, dList, gList] = await Promise.all([
      api.getUsers(),
      api.getDevices(),
      api.getGateways()
    ]);
    users.value = uList;
    allDevices.value = dList;
    allGateways.value = gList;
    store.users = uList;
  } catch (e: any) {
    ElMessage.error('加载用户数据失败: ' + e.message);
  }
};

const getRoleName = (role: UserRole) => {
  switch (role) {
    case 'ADMIN': return '系统管理员';
    case 'OPERATOR': return '现场操作员';
    case 'AUDITOR': return '安全审计员';
    case 'VIEWER': return '只读观察员';
    default: return role;
  }
};

const getRoleTagType = (role: UserRole) => {
  switch (role) {
    case 'ADMIN': return 'danger';
    case 'OPERATOR': return 'primary';
    case 'AUDITOR': return 'warning';
    case 'VIEWER': return 'info';
    default: return 'info';
  }
};

const getDeviceName = (devId: string) => {
  const d = allDevices.value.find(dev => dev.id === devId);
  return d ? d.name : devId;
};

const getGatewayName = (gwId: string) => {
  const g = allGateways.value.find(gw => gw.id === gwId);
  return g ? g.name : gwId;
};

const openUserDialog = (user?: User) => {
  if (user) {
    Object.assign(editingUser, {
      ...user,
      allowedDeviceIds: [...(user.allowedDeviceIds || [])]
    });
  } else {
    Object.assign(editingUser, {
      id: undefined,
      username: '',
      name: '',
      role: 'OPERATOR',
      allowedDeviceIds: [],
      status: 'ACTIVE'
    });
  }
  userDialogVisible.value = true;
};

const saveUserForm = async () => {
  if (!editingUser.username || !editingUser.name) {
    ElMessage.warning('请填写用户名与姓名');
    return;
  }
  savingUser.value = true;
  try {
    await api.saveUser(editingUser);
    ElMessage.success('用户信息已保存');
    userDialogVisible.value = false;
    await loadData();
    // Update active user if matching
    if (store.currentUser.id === editingUser.id) {
      const updated = users.value.find(u => u.id === editingUser.id);
      if (updated) store.currentUser = updated;
    }
  } catch (e: any) {
    ElMessage.error('保存用户失败: ' + e.message);
  } finally {
    savingUser.value = false;
  }
};

const handleDeleteUser = (user: User) => {
  ElMessageBox.confirm(`确定删除用户 [${user.name}] 吗？`, '删除确认', { type: 'warning' }).then(async () => {
    try {
      await api.deleteUser(user.id);
      ElMessage.success('用户已删除');
      await loadData();
    } catch (e: any) {
      ElMessage.error('删除用户失败: ' + e.message);
    }
  });
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.user-view-container {
  display: flex;
  flex-direction: column;
}

.users-card {
  padding: 16px 20px;
}

.card-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 14px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: #fff;
}

.user-avatar.role-admin {
  background: linear-gradient(135deg, #ef4444, #b91c1c);
}

.user-avatar.role-operator {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
}

.user-avatar.role-auditor {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.user-avatar.role-viewer {
  background: linear-gradient(135deg, #64748b, #475569);
}

.user-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.username {
  font-size: 11px;
  color: var(--text-muted);
}

.device-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.checkbox-group-container {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  padding: 10px;
  border-radius: var(--radius-sm);
  background: #151d2c;
  width: 100%;
}

.checkbox-row {
  margin-bottom: 6px;
}
</style>
