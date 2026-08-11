import https from 'https';

export interface FeishuUserInfo {
  open_id: string;
  user_id?: string;
  union_id?: string;
  name: string;
  en_name?: string;
  avatar_url?: string;
  avatar_thumb?: string;
  email?: string;
  mobile?: string;
  access_token?: string;
}

export class FeishuService {
  private appId: string;
  private appSecret: string;

  constructor() {
    this.appId = process.env.FEISHU_APP_ID || '';
    this.appSecret = process.env.FEISHU_APP_SECRET || '';
  }

  public setConfig(appId: string, appSecret: string) {
    this.appId = appId;
    this.appSecret = appSecret;
  }

  public getConfig() {
    return {
      appId: this.appId || process.env.FEISHU_APP_ID || '',
      redirectUri: process.env.FEISHU_REDIRECT_URI || '',
      isConfigured: !!(this.appId || process.env.FEISHU_APP_ID)
    };
  }

  /**
   * HTTPS 请求辅助函数
   */
  private request<T = any>(options: https.RequestOptions, postData?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.code !== undefined && parsed.code !== 0) {
              reject(new Error(`Feishu API Error: ${parsed.msg || 'Unknown error'} (code: ${parsed.code})`));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error(`Failed to parse Feishu response: ${body}`));
          }
        });
      });

      req.on('error', (e) => reject(e));

      if (postData) {
        req.write(JSON.stringify(postData));
      }
      req.end();
    });
  }

  /**
   * 获取 app_access_token (内部应用凭证)
   */
  public async getAppAccessToken(): Promise<string> {
    const appId = this.appId || process.env.FEISHU_APP_ID || '';
    const appSecret = this.appSecret || process.env.FEISHU_APP_SECRET || '';

    if (!appId || !appSecret) {
      throw new Error('未配置 FEISHU_APP_ID 或 FEISHU_APP_SECRET，请在 .env 中设置或通过系统设置配置');
    }

    const options: https.RequestOptions = {
      hostname: 'open.feishu.cn',
      path: '/open-apis/auth/v3/app_access_token/internal',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    };

    const data = {
      app_id: appId,
      app_secret: appSecret
    };

    const result = await this.request<{ app_access_token: string; code: number; msg: string }>(options, data);
    return result.app_access_token;
  }

  /**
   * 通过授权码 (code) 获取用户身份信息
   */
  public async getUserInfo(code: string, appAccessToken: string): Promise<FeishuUserInfo> {
    const options: https.RequestOptions = {
      hostname: 'open.feishu.cn',
      path: '/open-apis/authen/v1/access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${appAccessToken}`
      }
    };

    const data = {
      grant_type: 'authorization_code',
      code: code
    };

    const result = await this.request<{ data: FeishuUserInfo; code: number; msg: string }>(options, data);
    return result.data;
  }
}

export const feishuService = new FeishuService();
