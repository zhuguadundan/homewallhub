import { Context, Next } from 'koa';
import { JwtUtil, JwtPayload } from '../utils/jwt';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { dbGet } from '../config/database';

// 扩展Koa Context类型
declare module 'koa' {
  interface DefaultState {
    user?: JwtPayload;
    family?: {
      id: string;
      name: string;
      userRole: string;
    };
  }
}

/**
 * JWT认证中间件
 */
export const authMiddleware = async (ctx: Context, next: Next): Promise<void> => {
  try {
    // 获取Authorization头
    const authHeader = ctx.get('Authorization');
    const token = JwtUtil.extractTokenFromHeader(authHeader);
    
    if (!token) {
      throw new AuthenticationError('缺少访问令牌');
    }

    // 验证令牌
    const payload = JwtUtil.verifyAccessToken(token);
    
    // 验证用户是否仍然存在且激活
    const user = await dbGet(
      'SELECT id, username, email, is_active FROM users WHERE id = ? AND is_active = 1 AND is_deleted = 0',
      [payload.userId]
    );
    
    if (!user) {
      throw new AuthenticationError('用户不存在或已被禁用');
    }

    // 将用户信息添加到上下文
    ctx.state.user = payload;
    
    await next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    } else {
      throw new AuthenticationError('身份验证失败');
    }
  }
};

/**
 * 可选认证中间件 - 不强制要求认证，但如果有token会验证
 */
export const optionalAuthMiddleware = async (ctx: Context, next: Next): Promise<void> => {
  try {
    const authHeader = ctx.get('Authorization');
    const token = JwtUtil.extractTokenFromHeader(authHeader);
    
    if (token) {
      try {
        const payload = JwtUtil.verifyAccessToken(token);
        
        // 验证用户是否仍然存在且激活
        const user = await dbGet(
          'SELECT id, username, email, is_active FROM users WHERE id = ? AND is_active = 1 AND is_deleted = 0',
          [payload.userId]
        );
        
        if (user) {
          ctx.state.user = payload;
        }
      } catch (error) {
        // 可选认证失败时不抛出错误，只是不设置用户信息
      }
    }
    
    await next();
  } catch (error) {
    await next();
  }
};

/**
 * 家庭成员权限验证中间件
 */
export const familyMemberMiddleware = (requiredRole?: 'admin' | 'member') => {
  return async (ctx: Context, next: Next): Promise<void> => {
    const user = ctx.state.user;
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const familyId = ctx.params.familyId || (ctx.request.body as any)?.familyId || ctx.query.familyId;
    if (!familyId) {
      throw new AuthorizationError('缺少家庭ID');
    }

    // 查询用户在该家庭中的成员关系和角色
    const membership = await dbGet(
      `SELECT fm.*, f.name as family_name 
       FROM family_members fm 
       JOIN families f ON fm.family_id = f.id 
       WHERE fm.family_id = ? AND fm.user_id = ? AND fm.is_active = 1`,
      [familyId, user.userId]
    );

    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    // 角色权限检查
    if (requiredRole === 'admin' && membership.role !== 'admin') {
      throw new AuthorizationError('需要管理员权限');
    }

    // 将家庭信息添加到上下文
    ctx.state.family = {
      id: familyId,
      name: membership.family_name,
      userRole: membership.role,
    };

    await next();
  };
};