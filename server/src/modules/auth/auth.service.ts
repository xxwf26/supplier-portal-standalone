import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

interface AuthUser {
  id: number;
  username: string;
  role: string;
  /** bcrypt 哈希（优先） */
  passwordHash?: string;
  /** 明文（仅当未配置哈希时的兜底，会告警） */
  passwordPlain?: string;
}

/**
 * 账号来源（优先级：哈希 > 明文 > 开发兜底）：
 *   ADMIN_USERNAME / ADMIN_PASSWORD_HASH（bcrypt）或 ADMIN_PASSWORD（明文）
 *   VIEWER_USERNAME / VIEWER_PASSWORD_HASH 或 VIEWER_PASSWORD
 * 生成哈希：`node -e "console.log(require('bcryptjs').hashSync('你的密码',10))"`
 * 全部未配置时回退到 admin/admin123、viewer/viewer123，并在启动日志高声告警——
 * 仅供本地开发，生产务必配置 env。
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly users: AuthUser[];

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.users = this.buildUsers();
  }

  private buildUsers(): AuthUser[] {
    const adminHash = this.config.get<string>('ADMIN_PASSWORD_HASH');
    const adminPlain = this.config.get<string>('ADMIN_PASSWORD');
    const viewerHash = this.config.get<string>('VIEWER_PASSWORD_HASH');
    const viewerPlain = this.config.get<string>('VIEWER_PASSWORD');

    const usingFallback = !adminHash && !adminPlain && !viewerHash && !viewerPlain;
    if (usingFallback) {
      this.logger.warn(
        '[Auth] 未配置任何账号 env（ADMIN_PASSWORD_HASH/ADMIN_PASSWORD…），回退到默认 admin/admin123、viewer/viewer123。' +
          '生产环境请务必在 .env 配置账号密码！',
      );
    } else if (adminPlain && !adminHash) {
      this.logger.warn('[Auth] 正在使用明文 ADMIN_PASSWORD，建议改用 ADMIN_PASSWORD_HASH（bcrypt）。');
    }

    return [
      {
        id: 1,
        username: this.config.get<string>('ADMIN_USERNAME') || 'admin',
        role: 'admin',
        passwordHash: adminHash,
        passwordPlain: adminHash ? undefined : adminPlain || (usingFallback ? 'admin123' : undefined),
      },
      {
        id: 2,
        username: this.config.get<string>('VIEWER_USERNAME') || 'viewer',
        role: 'viewer',
        passwordHash: viewerHash,
        passwordPlain: viewerHash ? undefined : viewerPlain || (usingFallback ? 'viewer123' : undefined),
      },
    ];
  }

  async validateUser(
    username: string,
    password: string,
  ): Promise<{ id: number; username: string; role: string } | null> {
    const user = this.users.find((u) => u.username === username);
    if (!user) return null;

    let ok = false;
    if (user.passwordHash) {
      ok = await bcrypt.compare(password, user.passwordHash);
    } else if (user.passwordPlain !== undefined) {
      ok = password === user.passwordPlain;
    }
    return ok ? { id: user.id, username: user.username, role: user.role } : null;
  }

  login(user: { id: number; username: string; role: string }, rememberMe = false) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const expiresIn = rememberMe ? '30d' : '8h';
    return {
      access_token: this.jwtService.sign(payload, { expiresIn }),
      user: { username: user.username, role: user.role },
      expiresIn,
    };
  }
}
