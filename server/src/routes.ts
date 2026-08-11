import { Router, Request, Response } from 'express';
import { db } from './infrastructure/db';
import { feishuService } from './infrastructure/feishu';
import { controlService } from './services/controlService';
import { deviceService } from './services/deviceService';
import { protocolService } from './services/protocolService';
import { userService, auditService } from './services/userService';

export const apiRouter = Router();

// =======================
// 0. 认证体系 & 飞书 SSO 集成
// =======================
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: '请输入用户名' });
  }

  const user = db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ success: false, message: '操作员账号不存在' });
  }
  const expectedPassword = user.password || 'admin123';
  if (password !== expectedPassword) {
    return res.status(401).json({ success: false, message: '登录密码错误，请重新输入' });
  }
  if (user.status === 'DISABLED') {
    return res.status(403).json({ success: false, message: '该账号已被停用，请联系系统管理员' });
  }

  return res.json({
    success: true,
    data: {
      user,
      token: `tok_${user.id}_${Date.now()}`
    }
  });
});

// 获取飞书开放平台配置
apiRouter.get('/feishu/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: feishuService.getConfig()
  });
});

// 动态保存飞书开放平台配置
apiRouter.post('/feishu/config', (req: Request, res: Response) => {
  const { appId, appSecret } = req.body;
  if (appId) {
    feishuService.setConfig(appId, appSecret || '');
  }
  res.json({
    success: true,
    message: '飞书应用配置已保存',
    data: feishuService.getConfig()
  });
});

// 飞书授权码登录 / 免登交换
apiRouter.post('/feishu/login', async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: '缺少飞书授权码 (code)' });
  }

  try {
    const appAccessToken = await feishuService.getAppAccessToken();
    const feishuUser = await feishuService.getUserInfo(code, appAccessToken);
    const { open_id, user_id, name, avatar_url, email, mobile } = feishuUser;

    let user = db.getUserByFeishuId(user_id, open_id);

    if (!user && name) {
      user = db.getUserByUsername(name);
    }

    if (!user) {
      const newUserId = `usr-fs-${Date.now().toString(36)}`;
      user = {
        id: newUserId,
        username: name || `feishu_${open_id.slice(0, 8)}`,
        name: name || '飞书现场操作员',
        role: 'OPERATOR',
        allowedDeviceIds: [],
        status: 'ACTIVE',
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

    if (user.status === 'DISABLED') {
      return res.status(403).json({ success: false, message: '您的账号已被停用，请联系系统管理员' });
    }

    return res.json({
      success: true,
      data: {
        user,
        token: `tok_fs_${user.id}_${Date.now()}`
      }
    });
  } catch (err: any) {
    console.error('[FeishuLogin Error]', err);
    return res.status(500).json({ success: false, message: err.message || '飞书授权登录失败' });
  }
});

// =======================
// 1. 控制下发与状态读取
// =======================
apiRouter.post('/control', async (req: Request, res: Response) => {
  try {
    const { operator, deviceId, pointKey, value } = req.body;
    if (!deviceId || !pointKey || value === undefined) {
      return res.status(400).json({ success: false, message: '参数不完整 (需要 deviceId, pointKey, value)' });
    }

    const result = await controlService.executeCommand({ operator, deviceId, pointKey, value });
    if (!result.success) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/device-points/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const values = await controlService.readDevicePoints(deviceId);
    return res.json({ success: true, data: values });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =======================
// 2. 网关与受控设备管理
// =======================
apiRouter.get('/gateways', (req: Request, res: Response) => {
  res.json({ success: true, data: deviceService.getGateways() });
});

apiRouter.post('/gateways', (req: Request, res: Response) => {
  const gw = deviceService.saveGateway(req.body);
  res.json({ success: true, data: gw });
});

apiRouter.delete('/gateways/:id', (req: Request, res: Response) => {
  const ok = deviceService.deleteGateway(req.params.id);
  res.json({ success: ok });
});

apiRouter.post('/gateways/:id/test', async (req: Request, res: Response) => {
  try {
    const testRes = await deviceService.testGateway(req.params.id);
    res.json({ success: true, data: testRes });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

apiRouter.post('/gateways/:id/push-config', async (req: Request, res: Response) => {
  try {
    const result = await deviceService.pushConfigToGateway(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

apiRouter.post('/gateways/:id/pull-config', async (req: Request, res: Response) => {
  try {
    const result = await deviceService.pullConfigFromGateway(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

apiRouter.get('/devices', (req: Request, res: Response) => {
  res.json({ success: true, data: deviceService.getDevices() });
});

apiRouter.post('/devices', (req: Request, res: Response) => {
  const dev = deviceService.saveDevice(req.body);
  res.json({ success: true, data: dev });
});

apiRouter.delete('/devices/:id', (req: Request, res: Response) => {
  const ok = deviceService.deleteDevice(req.params.id);
  res.json({ success: ok });
});

apiRouter.get('/device-tree', (req: Request, res: Response) => {
  res.json({ success: true, data: deviceService.getDeviceTree() });
});

// =======================
// 3. 协议管理
// =======================
apiRouter.get('/connection-protocols', (req: Request, res: Response) => {
  res.json({ success: true, data: protocolService.getConnectionProtocols() });
});

apiRouter.post('/connection-protocols', (req: Request, res: Response) => {
  const conn = protocolService.saveConnectionProtocol(req.body);
  res.json({ success: true, data: conn });
});

apiRouter.delete('/connection-protocols/:id', (req: Request, res: Response) => {
  const ok = protocolService.deleteConnectionProtocol(req.params.id);
  res.json({ success: ok });
});

apiRouter.get('/control-templates', (req: Request, res: Response) => {
  res.json({ success: true, data: protocolService.getControlTemplates() });
});

apiRouter.post('/control-templates', (req: Request, res: Response) => {
  const tpl = protocolService.saveControlTemplate(req.body);
  res.json({ success: true, data: tpl });
});

apiRouter.delete('/control-templates/:id', (req: Request, res: Response) => {
  const ok = protocolService.deleteControlTemplate(req.params.id);
  res.json({ success: ok });
});

// =======================
// 4. 用户与权限管理
// =======================
apiRouter.get('/users', (req: Request, res: Response) => {
  res.json({ success: true, data: userService.getUsers() });
});

apiRouter.post('/users', (req: Request, res: Response) => {
  const user = userService.saveUser(req.body);
  res.json({ success: true, data: user });
});

apiRouter.delete('/users/:id', (req: Request, res: Response) => {
  const ok = userService.deleteUser(req.params.id);
  res.json({ success: ok });
});

// =======================
// 5. 审计日志管理
// =======================
apiRouter.get('/logs', (req: Request, res: Response) => {
  const { limit, operator, status, keyword } = req.query;
  const logs = auditService.getLogs({
    limit: limit ? Number(limit) : 200,
    operator: operator as string,
    status: status as string,
    keyword: keyword as string
  });
  res.json({ success: true, data: logs });
});

apiRouter.delete('/logs', (req: Request, res: Response) => {
  auditService.clearLogs();
  res.json({ success: true, message: '审计日志已清空' });
});

// =======================
// 6. 系统全量备份与导入恢复 (设备/协议/用户/日志)
// =======================
apiRouter.get('/system/backup', (req: Request, res: Response) => {
  const backup = db.exportBackup();
  res.json({ success: true, data: backup });
});

apiRouter.post('/system/restore', (req: Request, res: Response) => {
  const { backupData, mode = 'OVERWRITE' } = req.body;
  if (!backupData) {
    return res.status(400).json({ success: false, message: '缺少备份数据内容' });
  }

  try {
    const summary = db.importBackup(backupData, mode);
    res.json({
      success: true,
      message: `系统配置恢复成功（模式: ${mode === 'OVERWRITE' ? '全量覆盖' : '增量合并'}）`,
      data: summary
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '恢复失败: ' + err.message });
  }
});
