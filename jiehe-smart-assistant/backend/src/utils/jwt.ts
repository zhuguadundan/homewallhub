import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../middlewares/errorHandler';

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
  private static readonly ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'your-secret-key';
  private static readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
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
