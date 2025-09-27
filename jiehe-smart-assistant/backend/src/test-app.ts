import Koa from 'koa';
import cors from 'koa-cors';
import bodyParser from 'koa-bodyparser';

const app = new Koa();

// 基本中间件
app.use(cors());
app.use(bodyParser());

// 简单的健康检查路由
app.use(async (ctx, next) => {
  if (ctx.path === '/health') {
    ctx.body = { status: 'ok', message: 'Backend is running' };
    return;
  }
  
  if (ctx.path === '/api/test') {
    ctx.body = { message: 'Test API working', timestamp: new Date().toISOString() };
    return;
  }
  
  await next();
});

// 默认路由
app.use(async (ctx) => {
  ctx.body = { message: 'Hello from test backend!' };
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`✅ Test backend server is running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

export default app;