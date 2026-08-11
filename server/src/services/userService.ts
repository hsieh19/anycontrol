import { db } from '../infrastructure/db';
import { User, AuditLog } from '../domain/types';

export class UserService {
  getUsers(): User[] {
    return db.getUsers();
  }

  getUserById(id: string): User | undefined {
    return db.getUserById(id);
  }

  saveUser(data: Partial<User>): User {
    const id = data.id || `usr-${Date.now().toString(36)}`;
    const user: User = {
      id,
      username: data.username || 'new_user',
      name: data.name || '新用户',
      role: data.role || 'OPERATOR',
      allowedDeviceIds: data.allowedDeviceIds || [],
      status: data.status || 'ACTIVE',
      createdAt: data.createdAt || new Date().toISOString()
    };
    return db.saveUser(user);
  }

  deleteUser(id: string): boolean {
    return db.deleteUser(id);
  }
}

export const userService = new UserService();

export class AuditService {
  getLogs(query: {
    limit?: number;
    operator?: string;
    status?: string;
    keyword?: string;
  }): AuditLog[] {
    let logs = db.getAuditLogs(query.limit || 200);

    if (query.operator) {
      logs = logs.filter(l => l.operator.toLowerCase().includes(query.operator!.toLowerCase()));
    }

    if (query.status) {
      logs = logs.filter(l => l.status === query.status);
    }

    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      logs = logs.filter(l => 
        l.deviceName.toLowerCase().includes(kw) ||
        l.gatewayName.toLowerCase().includes(kw) ||
        l.pointName.toLowerCase().includes(kw) ||
        l.pointKey.toLowerCase().includes(kw) ||
        (l.errorMsg && l.errorMsg.toLowerCase().includes(kw))
      );
    }

    return logs;
  }

  clearLogs(): void {
    db.clearAuditLogs();
  }
}

export const auditService = new AuditService();
