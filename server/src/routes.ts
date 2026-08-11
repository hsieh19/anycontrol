import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "./infrastructure/db";
import { feishuService } from "./infrastructure/feishu";
import { controlService } from "./services/controlService";
import { deviceService } from "./services/deviceService";
import { protocolService } from "./services/protocolService";
import { userService, auditService, sanitizeUser } from "./services/userService";
import { authenticate, requireRole, signToken, AuthRequest } from "./middleware/auth";

export const apiRouter = Router();

// =======================
// 0. 认证体系 & 飞书 SSO 集成
// =======================

// 账号密码登录
apiRouter.post("/auth/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: "请输入用户名" });
  }

  const user = db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ success: false, message: "操作员账号不存在" });
  }
  if (user.status === "DISABLED") {
    return res.status(403).json({ success: false, message: "该账号已被停用，请联系系统管理员" });
  }

  // C2 修复：支持 bcrypt 哈希密码校验，同时兼容明文密码的自动迁移
  const storedPassword = user.password || "admin123";
  let passwordMatch = false;

  if (storedPassword.startsWith("$2")) {
    // 已哈希：使用 bcrypt 比对
    passwordMatch = bcrypt.compareSync(password || "", storedPassword);
  } else {
    // 旧版明文：直接比对后自动迁移为哈希
    passwordMatch = (password === storedPassword);
    if (passwordMatch) {
      const hashed = bcrypt.hashSync(storedPassword, 10);
      db.saveUser({ ...user, password: hashed });
    }
  }

  if (!passwordMatch) {
    return res.status(401).json({ success: false, message: "登录密码错误，请重新输入" });
  }

  // C1 修复：签发真实 JWT 令牌（8小时有效期）
  const token = signToken({ id: user.id, username: user.username, role: user.role });

  return res.json({
    success: true,
    data: { user: sanitizeUser(user), token }
  });
});

// 获取飞书开放平台配置（公开接口，前端用于判断是否启用飞书登录）
apiRouter.get("/feishu/config", (req: Request, res: Response) => {
  res.json({ success: true, data: feishuService.getConfig() });
});

// I1 修复：保存飞书配置需要 ADMIN 权限
apiRouter.post(
  "/feishu/config",
  authenticate,
  requireRole("ADMIN"),
  (req: AuthRequest, res: Response) => {
    const { appId, appSecret } = req.body;
    if (appId) feishuService.setConfig(appId, appSecret || "");
    res.json({ success: true, message: "飞书应用配置已保存", data: feishuService.getConfig() });
  }
);

// 飞书授权码登录 / 免登交换
apiRouter.post("/feishu/login", async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: "缺少飞书授权码 (code)" });
  }

  try {
    const appAccessToken = await feishuService.getAppAccessToken();
    const feishuUser = await feishuService.getUserInfo(code, appAccessToken);
    const { open_id, user_id, name, avatar_url, email, mobile } = feishuUser;

    // W4 修复：仅通过飞书 ID 查找，移除按姓名反查（可越权）的逻辑
    let user = db.getUserByFeishuId(user_id, open_id);

    if (!user) {
      // 检查当前系统内是否已有飞书绑定的管理员
      const allUsers = db.getUsers();
      const hasFeishuAdmin = allUsers.some(u => (u.feishuOpenId || u.feishuUserId) && u.role === "ADMIN");
      const initialRole = !hasFeishuAdmin ? "ADMIN" : "OPERATOR";

      const newUserId = `usr-fs-${Date.now().toString(36)}`;
      user = {
        id: newUserId,
        username: `feishu_${open_id.slice(0, 8)}`,
        name: name || (initialRole === "ADMIN" ? "飞书系统管理员" : "飞书现场操作员"),
        role: initialRole,
        allowedDeviceIds: [],
        status: "ACTIVE",
        feishuOpenId: open_id,
        feishuUserId: user_id,
        avatarUrl: avatar_url,
        email,
        mobile,
        createdAt: new Date().toISOString()
      };
      db.saveUser(user);
    } else {
      user = {
        ...user,
        name: name || user.name,
        feishuOpenId: open_id || user.feishuOpenId,
        feishuUserId: user_id || user.feishuUserId,
        avatarUrl: avatar_url || user.avatarUrl,
        email: email || user.email,
        mobile: mobile || user.mobile
      };
      db.saveUser(user);
    }

    if (user.status === "DISABLED") {
      return res.status(403).json({ success: false, message: "您的账号已被停用，请联系系统管理员" });
    }

    // C1 修复：飞书登录也签发 JWT
    const token = signToken({ id: user.id, username: user.username, role: user.role });

    return res.json({
      success: true,
      data: { user: sanitizeUser(user), token }
    });
  } catch (err: any) {
    console.error("[FeishuLogin Error]", err);
    return res.status(500).json({ success: false, message: err.message || "飞书授权登录失败" });
  }
});

// =======================
// 1. 控制下发与状态读取 (需要认证)
// =======================
apiRouter.post("/control", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { operator, deviceId, pointKey, value } = req.body;
    if (!deviceId || !pointKey || value === undefined) {
      return res.status(400).json({ success: false, message: "参数不完整 (需要 deviceId, pointKey, value)" });
    }
    // 以 JWT 中的用户名作为审计操作员（更可靠）
    const auditOperator = req.user?.username || operator || "现场操作员";
    const result = await controlService.executeCommand({ operator: auditOperator, deviceId, pointKey, value });
    if (!result.success) return res.status(500).json(result);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get("/device-points/:deviceId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const values = await controlService.readDevicePoints(req.params.deviceId);
    return res.json({ success: true, data: values });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =======================
// 2. 网关与受控设备管理 (需要认证)
// =======================
apiRouter.get("/gateways", authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: deviceService.getGateways() });
});

apiRouter.post("/gateways", authenticate, (req: Request, res: Response) => {
  const gw = deviceService.saveGateway(req.body);
  res.json({ success: true, data: gw });
});

apiRouter.delete("/gateways/:id", authenticate, requireRole("ADMIN", "OPERATOR"), (req: Request, res: Response) => {
  const ok = deviceService.deleteGateway(req.params.id);
  res.json({ success: ok });
});

apiRouter.post("/gateways/:id/test", authenticate, async (req: Request, res: Response) => {
  try {
    const testRes = await deviceService.testGateway(req.params.id);
    res.json({ success: true, data: testRes });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

apiRouter.post("/gateways/:id/push-config", authenticate, requireRole("ADMIN", "OPERATOR"), async (req: Request, res: Response) => {
  try {
    const result = await deviceService.pushConfigToGateway(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

apiRouter.post("/gateways/:id/pull-config", authenticate, async (req: Request, res: Response) => {
  try {
    const result = await deviceService.pullConfigFromGateway(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

apiRouter.get("/devices", authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: deviceService.getDevices() });
});

apiRouter.post("/devices", authenticate, (req: Request, res: Response) => {
  const dev = deviceService.saveDevice(req.body);
  res.json({ success: true, data: dev });
});

apiRouter.delete("/devices/:id", authenticate, requireRole("ADMIN", "OPERATOR"), (req: Request, res: Response) => {
  const ok = deviceService.deleteDevice(req.params.id);
  res.json({ success: ok });
});

apiRouter.get("/device-tree", authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: deviceService.getDeviceTree() });
});

// =======================
// 3. 协议管理 (需要认证)
// =======================
apiRouter.get("/connection-protocols", authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: protocolService.getConnectionProtocols() });
});

apiRouter.post("/connection-protocols", authenticate, requireRole("ADMIN", "OPERATOR"), (req: Request, res: Response) => {
  const conn = protocolService.saveConnectionProtocol(req.body);
  res.json({ success: true, data: conn });
});

apiRouter.delete("/connection-protocols/:id", authenticate, requireRole("ADMIN"), (req: Request, res: Response) => {
  const ok = protocolService.deleteConnectionProtocol(req.params.id);
  res.json({ success: ok });
});

apiRouter.get("/control-templates", authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: protocolService.getControlTemplates() });
});

apiRouter.post("/control-templates", authenticate, requireRole("ADMIN", "OPERATOR"), (req: Request, res: Response) => {
  const tpl = protocolService.saveControlTemplate(req.body);
  res.json({ success: true, data: tpl });
});

apiRouter.delete("/control-templates/:id", authenticate, requireRole("ADMIN"), (req: Request, res: Response) => {
  const ok = protocolService.deleteControlTemplate(req.params.id);
  res.json({ success: ok });
});

// =======================
// 4. 用户与权限管理 (需要认证)
// =======================
apiRouter.get("/users", authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: userService.getUsers() });
});

apiRouter.post("/users", authenticate, requireRole("ADMIN"), (req: Request, res: Response) => {
  const targetId = req.body.id;
  if (targetId) {
    const existing = db.getUserById(targetId);
    // 如果修改前是启用状态的管理员，而修改后不是 ADMIN 或被禁用
    if (existing && existing.role === "ADMIN" && existing.status === "ACTIVE") {
      const willBeAdmin = req.body.role === "ADMIN" && req.body.status !== "DISABLED";
      if (!willBeAdmin) {
        const otherAdmins = db.getUsers().filter(u => u.role === "ADMIN" && u.status === "ACTIVE" && u.id !== targetId);
        if (otherAdmins.length === 0) {
          return res.status(400).json({ success: false, message: "系统必须保留至少一位启用的系统管理员账号，无法将最后一位管理员降权或停用" });
        }
      }
    }
  }

  const user = userService.saveUser(req.body);
  res.json({ success: true, data: user });
});

apiRouter.delete("/users/:id", authenticate, requireRole("ADMIN"), (req: AuthRequest, res: Response) => {
  const targetId = req.params.id;
  const currentUserId = req.user?.id;

  // 1. 禁止删除当前操作员自己
  if (currentUserId && targetId === currentUserId) {
    return res.status(400).json({ success: false, message: "无法删除当前正在登录的管理员账号" });
  }

  // 2. 检查待删除用户是否存在
  const targetUser = db.getUserById(targetId);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: "用户不存在或已被删除" });
  }

  // 3. 如果删除的是 ADMIN 角色，检查系统内剩余启用的 ADMIN 数量
  if (targetUser.role === "ADMIN") {
    const allAdmins = db.getUsers().filter(u => u.role === "ADMIN" && u.status === "ACTIVE" && u.id !== targetId);
    if (allAdmins.length === 0) {
      return res.status(400).json({ success: false, message: "系统必须保留至少一位启用的系统管理员账号，无法删除最后一位管理员" });
    }
  }

  const ok = userService.deleteUser(targetId);
  res.json({ success: ok, message: ok ? "用户账号已成功删除" : "删除失败" });
});

// =======================
// 5. 审计日志管理 (需要认证)
// =======================
apiRouter.get("/logs", authenticate, (req: Request, res: Response) => {
  const { limit, operator, status, keyword } = req.query;
  const logs = auditService.getLogs({
    limit: limit ? Number(limit) : 200,
    operator: operator as string,
    status: status as string,
    keyword: keyword as string
  });
  res.json({ success: true, data: logs });
});

apiRouter.delete("/logs", authenticate, requireRole("ADMIN"), (req: Request, res: Response) => {
  auditService.clearLogs();
  res.json({ success: true, message: "审计日志已清空" });
});

// =======================
// 6. 系统全量备份与导入恢复 (仅 ADMIN)
// =======================
apiRouter.get("/system/backup", authenticate, requireRole("ADMIN"), (req: Request, res: Response) => {
  const backup = db.exportBackup();
  res.json({ success: true, data: backup });
});

// C3 修复：备份恢复需要 ADMIN 权限，并对导入数据做基本结构校验
apiRouter.post("/system/restore", authenticate, requireRole("ADMIN"), (req: Request, res: Response) => {
  const { backupData, mode = "OVERWRITE" } = req.body;
  if (!backupData) {
    return res.status(400).json({ success: false, message: "缺少备份数据内容" });
  }

  // C3 修复：基本结构校验，防止任意数据注入
  const rawData = backupData.data || backupData;
  if (typeof rawData !== "object" || rawData === null) {
    return res.status(400).json({ success: false, message: "备份数据格式无效" });
  }
  if (rawData.gateways !== undefined && !Array.isArray(rawData.gateways)) {
    return res.status(400).json({ success: false, message: "备份数据中 gateways 字段格式无效" });
  }
  if (rawData.devices !== undefined && !Array.isArray(rawData.devices)) {
    return res.status(400).json({ success: false, message: "备份数据中 devices 字段格式无效" });
  }
  if (rawData.users !== undefined && !Array.isArray(rawData.users)) {
    return res.status(400).json({ success: false, message: "备份数据中 users 字段格式无效" });
  }

  const allowedModes = ["OVERWRITE", "MERGE"];
  if (!allowedModes.includes(mode)) {
    return res.status(400).json({ success: false, message: "mode 参数无效，允许值: OVERWRITE | MERGE" });
  }

  try {
    const summary = db.importBackup(backupData, mode);
    res.json({
      success: true,
      message: `系统配置恢复成功（模式: ${mode === "OVERWRITE" ? "全量覆盖" : "增量合并"}）`,
      data: summary
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "恢复失败: " + err.message });
  }
});
