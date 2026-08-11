import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../infrastructure/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-prod';
const JWT_EXPIRES_IN = '8h';

export interface JwtPayload {
  id: string;
  username: string;
  role: string;
}

// 扩展 Express Request，注入解析后的用户身份
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * 签发 JWT 令牌（有效期 8 小时）
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * JWT 身份认证中间件
 * 从 Authorization: Bearer <token> 头部提取并验证令牌，并实时同步数据库中最新角色与状态
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): any {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未提供认证令牌，请先登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    // 实时同步数据库中用户的最新角色与启用状态，解决提权后 Token 角色滞后问题
    const liveUser = db.getUserById(decoded.id);
    if (liveUser) {
      if (liveUser.status === 'DISABLED') {
        return res.status(403).json({ success: false, message: '您的账号已被停用，请联系系统管理员' });
      }
      req.user = {
        id: liveUser.id,
        username: liveUser.username,
        role: liveUser.role
      };
    } else {
      req.user = decoded;
    }

    next();
  } catch (e: any) {
    const msg = e.name === 'TokenExpiredError'
      ? '登录会话已过期（8小时），请重新登录'
      : '认证令牌无效，请重新登录';
    return res.status(401).json({ success: false, message: msg });
  }
}

/**
 * 角色权限校验中间件（需在 authenticate 之后使用）
 * @param roles 允许访问的角色列表
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '未认证' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `权限不足，此操作需要 [${roles.join(' / ')}] 角色`
      });
    }
    next();
  };
}
