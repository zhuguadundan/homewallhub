# 家和智能助手 (JieHe Smart Assistant)

一个基于 Koa.js + Vue 3 + TypeScript 构建的智能家庭管理应用，提供任务管理、库存管理、点菜系统、共享日历、家庭留言板等功能。

## 🚀 快速启动

### 环境要求

- **Node.js**: 18.x 或更高版本
- **NPM**: 8.x 或更高版本  
- **数据库**: SQLite (自动创建)

### 1. 项目设置

```bash
# 克隆项目
git clone <项目地址>
cd jiehe-smart-assistant

# 安装依赖
npm run install:all  # 根目录提供一键安装脚本
```

### 2. 环境配置

#### 后端配置
复制环境变量模板并配置：
```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件：
```env
# 服务器配置
PORT=8080
NODE_ENV=development

# 前端地址 (用于CORS)
FRONTEND_URL=http://localhost:3000

# 数据库配置 (SQLite自动创建)
DATABASE_PATH=./database/jiehe.db

# JWT密钥 (请更换为安全的密钥)
JWT_SECRET=your-super-secret-jwt-access-key-here
JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# AI服务配置 (可选)
AI_SERVICE_ENABLED=false
QIANWEN_API_KEY=your-qianwen-api-key
QIANWEN_API_URL=https://dashscope.aliyuncs.com/api/v1
QIANWEN_MODEL=qwen-turbo
AI_BUDGET_MONTHLY_LIMIT=100

# 文件上传配置
FILE_UPLOAD_MAX_SIZE=10485760
UPLOAD_DIR=./uploads
```

#### 前端配置
```bash
cd frontend
# 前端通常使用默认配置即可
# 如需自定义API地址，可创建 .env.local
echo "VITE_API_BASE_URL=http://localhost:8080/api" > .env.local
```

### 3. 启动服务

#### 开发模式 (推荐)
```bash
# 在项目根目录运行，同时启动前后端
npm run dev
```

或者分别启动：
```bash
# 终端1: 启动后端
cd backend
npm run dev

# 终端2: 启动前端  
cd frontend
npm run dev
```

#### 生产模式
```bash
# 构建前端
cd frontend
npm run build

# 启动后端 (会自动服务前端静态文件)
cd backend  
npm run start
```

### 4. 访问应用

- **前端地址**: http://localhost:3000
- **后端API**: http://localhost:8080
- **API文档**: http://localhost:8080/health

## 🧪 功能测试指南

### 1. 用户注册和登录测试

#### 方法1: 使用前端界面
1. 访问 http://localhost:3000
2. 点击"注册"按钮
3. 填写用户信息完成注册
4. 使用注册信息登录

#### 方法2: 使用API直接测试
```bash
# 注册用户
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com", 
    "password": "Test123456",
    "phone": "13800138000"
  }'

# 登录
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }'
```

### 2. 家庭管理测试

```bash
# 创建家庭 (需要先获取token)
curl -X POST http://localhost:8080/api/families \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "我的家庭",
    "description": "温馨的家"
  }'

# 获取家庭列表
curl -X GET http://localhost:8080/api/families \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. 库存管理测试

```bash
# 获取食材分类
curl -X GET http://localhost:8080/api/inventory/categories \
  -H "Authorization: Bearer YOUR_TOKEN"

# 添加库存记录
curl -X POST http://localhost:8080/api/families/FAMILY_ID/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "food_item_id": "cat_vegetables",
    "quantity": 2,
    "unit": "kg", 
    "purchase_date": "2025-01-15",
    "expire_date": "2025-01-25",
    "location": "冰箱"
  }'
```

### 4. 任务管理测试

```bash
# 创建任务
curl -X POST http://localhost:8080/api/families/FAMILY_ID/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "买菜",
    "description": "去超市购买今晚的食材",
    "priority": 2,
    "due_date": "2025-01-16T18:00:00Z"
  }'

# 获取任务列表
curl -X GET "http://localhost:8080/api/families/FAMILY_ID/tasks?page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. 留言板测试

```bash
# 发布留言
curl -X POST http://localhost:8080/api/families/FAMILY_ID/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "家庭通知",
    "content": "大家记得参加周末的家庭聚餐！",
    "priority": 2
  }'

# 获取留言列表
curl -X GET "http://localhost:8080/api/families/FAMILY_ID/messages?page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔧 开发工具

### 数据库查看
```bash
# 进入SQLite数据库
cd backend/database
sqlite3 jiehe.db

# 查看所有表
.tables

# 查看用户表
SELECT * FROM users;

# 查看家庭表  
SELECT * FROM families;

# 退出
.quit
```

### 日志查看
```bash
# 查看后端日志
cd backend
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log
```

### 重置数据库
```bash
# 删除数据库文件重新开始
cd backend
rm -f database/jiehe.db
npm run dev  # 重启会自动创建新数据库
```

## 📁 项目结构

```
jiehe-smart-assistant/
├── backend/                 # 后端 Koa.js 应用
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── models/         # 数据模型  
│   │   ├── routes/         # 路由定义
│   │   ├── middlewares/    # 中间件
│   │   ├── services/       # 业务服务
│   │   ├── utils/          # 工具函数
│   │   └── config/         # 配置文件
│   ├── database/           # 数据库文件和Schema
│   ├── logs/              # 日志文件
│   └── uploads/           # 文件上传目录
├── frontend/               # 前端 Vue 3 应用  
│   ├── src/
│   │   ├── components/     # Vue组件
│   │   ├── views/         # 页面视图
│   │   ├── stores/        # Pinia状态管理
│   │   ├── router/        # Vue Router
│   │   ├── api/           # API调用
│   │   └── utils/         # 工具函数
│   └── public/            # 静态资源
└── docs/                  # 项目文档
```

## 🐛 故障排除

### 常见问题

#### 1. 端口被占用
```bash
# 查看端口占用
lsof -i :8080
lsof -i :3000

# 杀死进程
kill -9 PID
```

#### 2. 数据库连接失败
- 检查 `backend/database/` 目录是否存在
- 检查文件权限
- 删除 `jiehe.db` 重新创建

#### 3. 前端无法连接后端
- 确认后端服务正常启动
- 检查 `FRONTEND_URL` 环境变量配置
- 查看浏览器控制台CORS错误

#### 4. Token失效
- 重新登录获取新token
- 检查JWT配置和过期时间

### 获取详细错误信息
```bash
# 启用详细日志模式
cd backend
NODE_ENV=development npm run dev

# 查看实时日志
tail -f logs/app.log
```

## 🚀 部署指南

### 生产环境部署

1. **构建前端**
```bash
cd frontend
npm run build
```

2. **配置生产环境变量**
```bash
cd backend
cp .env.example .env.production
# 编辑生产环境配置
```

3. **启动生产服务**
```bash
cd backend
npm run start
```

### Docker部署 (可选)
```bash
# 构建镜像
docker build -t jiehe-smart-assistant .

# 运行容器
docker run -p 8080:8080 -v $(pwd)/data:/app/backend/database jiehe-smart-assistant
```

## 📞 技术支持

- **Issues**: 在GitHub提交问题
- **Email**: support@jiehe.com
- **文档**: 查看 `docs/` 目录了解更多技术细节

## 📝 更新日志

### v1.0.0 (2025-01-15)
- ✅ 基础用户管理系统
- ✅ 家庭管理功能
- ✅ 任务分配系统  
- ✅ 智能库存管理
- ✅ 家庭留言板
- ✅ 共享日历系统
- 🔧 修复数据库Schema一致性问题
- 🔧 修复后端编译错误
- 🔧 优化API响应结构

---

**开始你的智能家庭管理之旅吧！** 🏠✨