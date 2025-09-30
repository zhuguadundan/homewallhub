import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../middlewares/errorHandler';
import { logger } from './logger';

// JWT载荷接口
export interface JwtPayload {
  userId: string;
  username: string;
  familyId?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

// JWT工具类
export class JwtUtil {
  // 强制要求配置访问密钥（JWT_ACCESS_SECRET 或 JWT_SECRET 二选一）和刷新密钥（JWT_REFRESH_SECRET）
  private static readonly ACCESS_TOKEN_SECRET: string = (() => {
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      // 启动即失败，避免使用不安全默认值
      throw new Error('缺少JWT访问令牌密钥: 请设置 JWT_ACCESS_SECRET 或 JWT_SECRET');
    }
    return secret;
  })();

  private static readonly REFRESH_TOKEN_SECRET: string = (() => {
    // 向后兼容：若未设置 JWT_REFRESH_SECRET，则回退到 JWT_SECRET，并给出警告
    const refresh = process.env.JWT_REFRESH_SECRET;
    if (refresh && refresh.length > 0) return refresh;

    const fallback = process.env.JWT_SECRET;
    if (fallback && fallback.length > 0) {
      logger.warn('未设置 JWT_REFRESH_SECRET，已回退使用 JWT_SECRET 作为刷新令牌密钥（不推荐）。请尽快设置独立的 JWT_REFRESH_SECRET。');
      return fallback;
    }
    throw new Error('缺少JWT刷新令牌密钥: 请设置 JWT_REFRESH_SECRET（或临时设置 JWT_SECRET 作为回退）');
  })();

  private static readonly ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '24h';
  private static readonly REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  /**
   * 生成访问令牌
   */
  static generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload as any, this.ACCESS_TOKEN_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES,
    } as any);
  }

  /**
   * 生成刷新令牌
   */
  static generateRefreshToken(payload: Pick<JwtPayload, 'userId' | 'username'>): string {
    return jwt.sign(payload as any, this.REFRESH_TOKEN_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES,
    } as any);
  }  /**
   * 验证访问令牌
   */
  static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.ACCESS_TOKEN_SECRET) as JwtPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('访问令牌已过期');
      } else if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('无效的访问令牌');
      } else {
        throw new AuthenticationError('令牌验证失败');
      }
    }
  }

  /**
   * 验证刷新令牌
   */
  static verifyRefreshToken(token: string): Pick<JwtPayload, 'userId' | 'username'> {
    try {
      return jwt.verify(token, this.REFRESH_TOKEN_SECRET) as Pick<JwtPayload, 'userId' | 'username'>;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('刷新令牌已过期，请重新登录');
      } else if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('无效的刷新令牌');
      } else {
        throw new AuthenticationError('令牌验证失败');
      }
    }
  }

  /**
   * 从请求头中提取令牌
   */
  static extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }
    
    return parts[1];
  }

  /**
   * 生成令牌对
   */
  static generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({
      userId: payload.userId,
      username: payload.username,
    });

    return { accessToken, refreshToken };
  }
}
