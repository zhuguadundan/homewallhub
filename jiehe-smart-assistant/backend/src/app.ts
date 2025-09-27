import Koa from 'koa';
import cors from 'koa-cors';
import helmet from 'koa-helmet';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import rateLimit from 'koa-ratelimit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

// 导入配置和工具
import { logger } from './utils/logger';
import { errorHandler } from './middlewares/errorHandler';
import { authMiddleware } from './middlewares/auth';
import { validateMiddleware } from './middlewares/validate';
import { initDatabase } from './config/database';
import { socketManager } from './middleware/socket';
import { CalendarReminderService } from './services/calendarReminderService';

// 导入路由
import authRoutes from './routes/auth';
import familyRoutes from './routes/family';
import taskRoutes from './routes/task';
import inventoryRoutes from './routes/inventory';
import menuRoutes from './routes/menuRoutes';
import calendarRoutes from './routes/calendarRoutes';
import messageRoutes from './routes/messageRoutes';
import aiRoutes from './routes/ai';
import analyticsRoutes from './routes/analytics';

// 加载环境变量
dotenv.config();

const app = new Koa();
const server = createServer(app.callback());

// Socket.IO将由socketManager管理

// 健康检查端点 (最优先，绕过所有中间件)
app.use(async (ctx, next) => {
  if (ctx.path === '/health') {
    ctx.status = 200;
    ctx.body = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    };
    return;
  }
  await next();
});

// 全局中间件
app.use(errorHandler);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(koaLogger());
app.use(bodyParser());

// 限流中间件
const rateLimitMap = new Map();
app.use(rateLimit({
  driver: 'memory',
  db: rateLimitMap,
  duration: 60000, // 1分钟
  errorMessage: '请求过于频繁，请稍后再试',
  id: (ctx: any) => ctx.ip,
  headers: {
    remaining: 'Rate-Limit-Remaining',
    reset: 'Rate-Limit-Reset',
    total: 'Rate-Limit-Total'
  },
  max: 100 // 每分钟100次请求
}) as any);

// 路由配置
app.use(authRoutes.routes()).use(authRoutes.allowedMethods());
app.use(authMiddleware); // 认证中间件，保护以下路由
app.use(familyRoutes.routes()).use(familyRoutes.allowedMethods());
app.use(taskRoutes.routes()).use(taskRoutes.allowedMethods());
app.use(inventoryRoutes.routes()).use(inventoryRoutes.allowedMethods());
app.use(menuRoutes.routes()).use(menuRoutes.allowedMethods());
app.use(calendarRoutes.routes()).use(calendarRoutes.allowedMethods());
app.use(messageRoutes.routes()).use(messageRoutes.allowedMethods());
app.use(aiRoutes.routes()).use(aiRoutes.allowedMethods());
app.use(analyticsRoutes.routes()).use(analyticsRoutes.allowedMethods());

// 初始化服务
async function initializeApp(): Promise<void> {
  try {
    // 初始化数据库
    await initDatabase();
    logger.info('数据库初始化完成');
    
    // 初始化Socket.IO服务
    socketManager.init(server);
    logger.info('Socket.IO服务初始化完成');
    
    // 启动日历提醒服务
    CalendarReminderService.start();
    logger.info('日历提醒服务启动完成');
    
  } catch (error) {
    logger.error('应用初始化失败:', error);
    process.exit(1);
  }
}

// 启动服务器
const PORT = parseInt(process.env.PORT as string) || 8081;

async function startServer(): Promise<void> {
  await initializeApp();

  server.listen(PORT, () => {
    logger.info(`服务器启动成功，端口: ${PORT}`);
    logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
  });
}

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，开始优雅关闭...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，开始优雅关闭...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

// 启动应用
startServer().catch(error => {
  logger.error('启动服务器失败:', error);
  process.exit(1);
});

export { app, server };