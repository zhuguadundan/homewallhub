import { Context } from 'koa';

// 统一响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  timestamp: string;
  path: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 分页信息接口
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

// 响应工具类
export class ResponseUtil {
  /**
   * 成功响应
   */
  static success<T>(
    ctx: Context,
    data?: T,
    message: string = '操作成功',
    code: string = 'SUCCESS'
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      code,
      timestamp: new Date().toISOString(),
      path: ctx.path,
    };

    ctx.status = 200;
    ctx.body = response;
  }  /**
   * 创建成功响应
   */
  static created<T>(
    ctx: Context,
    data?: T,
    message: string = '创建成功',
    code: string = 'CREATED'
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      code,
      timestamp: new Date().toISOString(),
      path: ctx.path,
    };

    ctx.status = 201;
    ctx.body = response;
  }

  /**
   * 分页响应
   */
  static paginated<T>(
    ctx: Context,
    data: T[],
    pagination: PaginationInfo,
    message: string = '获取成功',
    code: string = 'SUCCESS'
  ): void {
    const totalPages = Math.ceil(pagination.total / pagination.pageSize);
    
    const response: ApiResponse<T[]> = {
      success: true,
      data,
      message,
      code,
      timestamp: new Date().toISOString(),
      path: ctx.path,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages,
      },
    };

    ctx.status = 200;
    ctx.body = response;
  }

  /**
   * 无内容响应
   */
  static noContent(ctx: Context, message: string = '操作成功'): void {
    // 为确保客户端一致性与兼容性，返回 200 并携带统一响应结构
    const response: ApiResponse = {
      success: true,
      message,
      timestamp: new Date().toISOString(),
      path: ctx.path,
    };

    ctx.status = 200;
    ctx.body = response;
  }
}
