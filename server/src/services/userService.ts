import bcrypt from "bcryptjs";
import { db } from "../infrastructure/db";
import { User, AuditLog } from "../domain/types";

/**
 * 移除用户密码字段后安全返回（用于 API 响应）
 */
export function sanitizeUser(user: User): Omit<User, "password"> {
  const { password, ...safe } = user;
  return safe;
}

export class UserService {
  getUsers(): Omit<User, "password">[] {
    return db.getUsers().map(sanitizeUser);
  }

  getUserById(id: string): Omit<User, "password"> | undefined {
    const user = db.getUserById(id);
    return user ? sanitizeUser(user) : undefined;
  }

  /**
   * I2 修复：saveUser 保留未传入的敏感字段（password、飞书绑定、头像等）
   * 若传入 password 则自动进行 bcrypt 哈希
   */
  saveUser(data: Partial<User>): Omit<User, "password"> {
    const id = data.id || `usr-${Date.now().toString(36)}`;
    const existing = db.getUserById(id);

    // 密码处理：若提供了新密码则哈希；否则保留已有哈希
    let password: string | undefined = existing?.password;
    if (data.password !== undefined && data.password.length > 0) {
      // 避免重复哈希
      password = data.password.startsWith("$2")
        ? data.password
        : bcrypt.hashSync(data.password, 10);
    }

    const user: User = {
      id,
      username: data.username ?? existing?.username ?? "new_user",
      name: data.name ?? existing?.name ?? "新用户",
      role: data.role ?? existing?.role ?? "OPERATOR",
      allowedDeviceIds:
        data.allowedDeviceIds !== undefined
          ? data.allowedDeviceIds
          : (existing?.allowedDeviceIds ?? []),
      status: data.status ?? existing?.status ?? "ACTIVE",
      password,
      // I2 修复：保留飞书绑定、头像、邮箱、手机等字段
      feishuOpenId:
        data.feishuOpenId !== undefined ? data.feishuOpenId : existing?.feishuOpenId,
      feishuUserId:
        data.feishuUserId !== undefined ? data.feishuUserId : existing?.feishuUserId,
      avatarUrl:
        data.avatarUrl !== undefined ? data.avatarUrl : existing?.avatarUrl,
      email: data.email !== undefined ? data.email : existing?.email,
      mobile: data.mobile !== undefined ? data.mobile : existing?.mobile,
      createdAt: data.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    };

    return sanitizeUser(db.saveUser(user));
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
      logs = logs.filter((l) =>
        l.operator.toLowerCase().includes(query.operator!.toLowerCase())
      );
    }

    if (query.status) {
      logs = logs.filter((l) => l.status === query.status);
    }

    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      logs = logs.filter(
        (l) =>
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
