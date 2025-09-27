import { Context, Next } from 'koa';
import { logger } from '../utils/logger';

// 自定义错误类
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  
  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// 常见错误类型
export class ValidationError extends AppError {
  public details?: { [key: string]: string[] } | undefined;
  
  constructor(message: string, details?: { [key: string]: string[] }) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = '认证失败') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = '权限不足') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = '资源不存在') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = '资源冲突') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = '请求过于频繁') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

// 错误响应接口
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  path: string;
  method: string;
}

// 全局错误处理中间件
export const errorHandler = async (ctx: Context, next: Next): Promise<void> => {
  try {
    await next();
    
    // 处理404情况
    if (ctx.status === 404 && !ctx.body) {
      throw new NotFoundError('接口不存在');
    }
  } catch (error: any) {
    // 记录错误日志
    const errorInfo = {
      method: ctx.method,
      url: ctx.url,
      headers: ctx.headers,
      body: ctx.request.body,
      query: ctx.query,
      ip: ctx.ip,
      userAgent: ctx.get('User-Agent'),
      error: error.message,
      stack: error.stack,
    };

    if (error instanceof AppError && error.isOperational) {
      // 可预期的业务错误，记录为info级别
      logger.info('业务错误:', errorInfo);
    } else {
      // 未预期的系统错误，记录为error级别
      logger.error('系统错误:', errorInfo);
    }

    // 构造错误响应
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || '服务器内部错误',
        ...(error instanceof ValidationError && error.details && {
          details: error.details
        }),
        ...(process.env.NODE_ENV === 'development' && !error.details && { 
          details: error.stack 
        })
      },
      timestamp: new Date().toISOString(),
      path: ctx.path,
      method: ctx.method,
    };

    // 设置HTTP状态码
    ctx.status = error.statusCode || 500;
    ctx.body = errorResponse;

    // 确保响应头正确设置
    ctx.type = 'application/json';
  }
};