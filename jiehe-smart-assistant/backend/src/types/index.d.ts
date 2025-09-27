// 类型声明文件
declare module 'koa-ratelimit' {
  import { Middleware } from 'koa';
  
  interface RateLimitOptions {
    driver?: string;
    db?: Map<string, any>;
    duration?: number;
    errorMessage?: string;
    id?: (ctx: any) => string;
    headers?: {
      remaining?: string;
      reset?: string;
      total?: string;
    };
    max?: number;
  }
  
  function rateLimit(options: RateLimitOptions): Middleware;
  export = rateLimit;
}