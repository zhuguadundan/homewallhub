-- 家和智能助手数据库架构
-- 创建时间: 2024年
-- 版本: 4.0 (Sprint 4: 点菜系统+共享日历)

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ==============================================
-- 核心用户和家庭管理表
-- ==============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  password_hash TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 家庭表
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE,
  max_members INTEGER DEFAULT 10,
  settings TEXT, -- JSON格式的家庭设置
  is_active INTEGER DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 家庭成员关系表
CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- admin, member, guest
  permissions TEXT, -- JSON格式的权限设置
  nickname TEXT,
  joined_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(family_id, user_id)
);

-- ==============================================
-- 任务管理系统
-- ==============================================

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  assigned_to TEXT,
  created_by TEXT NOT NULL,
  due_date TEXT,
  completed_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 任务附件表
CREATE TABLE IF NOT EXISTS task_attachments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- ==============================================
-- 库存管理系统
-- ==============================================

-- 物品类别表
CREATE TABLE IF NOT EXISTS inventory_categories (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#1890ff',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 库存物品表
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  category_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT DEFAULT '个',
  current_quantity REAL DEFAULT 0,
  min_threshold REAL DEFAULT 0,
  max_threshold REAL,
  location TEXT,
  barcode TEXT,
  image_url TEXT,
  average_price REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES inventory_categories(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 库存批次表（FIFO管理）
CREATE TABLE IF NOT EXISTS inventory_batches (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  batch_number TEXT,
  original_quantity REAL NOT NULL,
  remaining_quantity REAL NOT NULL,
  purchase_price REAL,
  expiry_date TEXT,
  supplier TEXT,
  purchase_date TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 库存操作记录表
CREATE TABLE IF NOT EXISTS inventory_operations (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  batch_id TEXT,
  operation_type TEXT NOT NULL, -- in, out, adjust, expired
  quantity REAL NOT NULL,
  remaining_after REAL NOT NULL,
  price REAL,
  reason TEXT,
  operator_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES inventory_batches(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

-- ==============================================
-- 点菜系统 (Sprint 4)
-- ==============================================

-- 菜单表
CREATE TABLE IF NOT EXISTS menus (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_date TEXT, -- 目标用餐日期
  status TEXT DEFAULT 'draft', -- draft, voting, finalized, completed
  voting_deadline TEXT,
  created_by TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 菜品表
CREATE TABLE IF NOT EXISTS dishes (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 主食, 荤菜, 素菜, 汤品, 甜点等
  estimated_price REAL,
  image_url TEXT,
  ingredients TEXT, -- JSON格式存储食材列表
  difficulty_level TEXT DEFAULT 'medium', -- easy, medium, hard
  preparation_time INTEGER, -- 预计制作时间（分钟）
  created_by TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 菜品投票表
CREATE TABLE IF NOT EXISTS menu_votes (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL,
  dish_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote_type TEXT NOT NULL, -- like, dislike, neutral
  priority INTEGER DEFAULT 1, -- 优先级权重 1-5
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
  FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(dish_id, user_id)
);

-- ==============================================
-- 共享日历系统 (Sprint 4)
-- ==============================================

-- 日历事件表
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT,
  event_type TEXT DEFAULT 'other', -- meeting, birthday, holiday, reminder, task, other
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  is_all_day INTEGER DEFAULT 0,
  recurrence_rule TEXT, -- RRULE格式的重复规则
  created_by TEXT NOT NULL,
  status TEXT DEFAULT 'planned', -- planned, confirmed, cancelled, completed
  visibility TEXT DEFAULT 'family', -- public, private, family
  color TEXT DEFAULT '#1890ff',
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 事件参与者表
CREATE TABLE IF NOT EXISTS calendar_event_participants (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  participation_status TEXT DEFAULT 'invited', -- invited, accepted, declined, tentative
  response_time TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(event_id, user_id)
);

-- 事件提醒表
CREATE TABLE IF NOT EXISTS calendar_reminders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  reminder_type TEXT DEFAULT 'notification', -- notification, email, sms
  remind_before_minutes INTEGER DEFAULT 15,
  message TEXT,
  is_sent INTEGER DEFAULT 0,
  recipient_id TEXT, -- 指定接收人，NULL表示发送给所有参与者
  created_at TEXT NOT NULL,
  sent_at TEXT,
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id)
);

-- 重复事件实例表
CREATE TABLE IF NOT EXISTS recurring_event_instances (
  id TEXT PRIMARY KEY,
  parent_event_id TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  is_modified INTEGER DEFAULT 0, -- 是否被单独修改
  is_cancelled INTEGER DEFAULT 0, -- 是否被取消
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);

-- ==============================================
-- 消息和通知系统
-- ==============================================

-- 家庭留言板表
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- text, image, file, reminder, announcement
  category TEXT DEFAULT 'general', -- general, urgent, reminder, family_news, celebration, other
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  is_pinned INTEGER DEFAULT 0,
  attachments TEXT, -- JSON格式的附件URL数组
  mentioned_users TEXT, -- JSON格式的@用户ID数组
  expires_at TEXT, -- 过期时间
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 留言反应表
CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL, -- like, love, laugh, angry, sad, wow
  created_at TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(message_id, user_id)
);

-- 留言已读状态表
CREATE TABLE IF NOT EXISTS message_read_status (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT NOT NULL,
  is_read INTEGER DEFAULT 1,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(message_id, user_id)
);

-- 留言评论表
CREATE TABLE IF NOT EXISTS message_comments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_comment_id TEXT, -- 回复评论的ID
  mentioned_users TEXT, -- JSON格式的@用户ID数组
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (parent_comment_id) REFERENCES message_comments(id)
);

-- 通知设置表
CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  enable_mention_notifications INTEGER DEFAULT 1,
  enable_message_notifications INTEGER DEFAULT 1,
  enable_urgent_notifications INTEGER DEFAULT 1,
  notification_methods TEXT, -- JSON格式的通知方式数组
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  UNIQUE(user_id, family_id)
);

-- 系统通知表
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  family_id TEXT,
  user_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- system, task, inventory, menu, calendar, mention
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  is_read INTEGER DEFAULT 0,
  data TEXT, -- JSON格式的相关数据
  created_at TEXT NOT NULL,
  read_at TEXT,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==============================================
-- 索引创建
-- ==============================================

-- 用户相关索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- 家庭相关索引
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_active ON family_members(is_active);

-- 任务相关索引
CREATE INDEX IF NOT EXISTS idx_tasks_family_id ON tasks(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- 库存相关索引
CREATE INDEX IF NOT EXISTS idx_inventory_items_family_id ON inventory_items(family_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category_id ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_item_id ON inventory_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry_date ON inventory_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_operations_item_id ON inventory_operations(item_id);

-- 菜单相关索引
CREATE INDEX IF NOT EXISTS idx_menus_family_id ON menus(family_id);
CREATE INDEX IF NOT EXISTS idx_menus_status ON menus(status);
CREATE INDEX IF NOT EXISTS idx_menus_target_date ON menus(target_date);
CREATE INDEX IF NOT EXISTS idx_dishes_menu_id ON dishes(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_votes_menu_id ON menu_votes(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_votes_dish_id ON menu_votes(dish_id);
CREATE INDEX IF NOT EXISTS idx_menu_votes_user_id ON menu_votes(user_id);

-- 日历相关索引
CREATE INDEX IF NOT EXISTS idx_calendar_events_family_id ON calendar_events(family_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_time ON calendar_events(end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_participants_event_id ON calendar_event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_participants_user_id ON calendar_event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_event_id ON calendar_reminders(event_id);

-- 通知相关索引
CREATE INDEX IF NOT EXISTS idx_notifications_family_id ON notifications(family_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ==============================================
-- AI智能服务系统 (Sprint 6)
-- ==============================================

-- AI预算记录表
CREATE TABLE IF NOT EXISTS ai_budget_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    family_id TEXT NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN (
        'recipe_recommendation',
        'meal_planning',
        'shopping_list',
        'task_suggestion',
        'schedule_analysis',
        'general_assistant'
    )),
    tokens INTEGER NOT NULL,
    cost DECIMAL(10,4) NOT NULL,
    request_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (family_id) REFERENCES families(id)
);

-- AI预算记录表索引
CREATE INDEX IF NOT EXISTS idx_ai_budget_records_user ON ai_budget_records(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_budget_records_family ON ai_budget_records(family_id);
CREATE INDEX IF NOT EXISTS idx_ai_budget_records_date ON ai_budget_records(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_budget_records_type ON ai_budget_records(request_type);
CREATE INDEX IF NOT EXISTS idx_ai_budget_records_family_date ON ai_budget_records(family_id, created_at);

-- ==============================================
-- 高级数据分析系统 (Sprint 8)
-- ==============================================

-- 成本记录表 (用于成本分析)
CREATE TABLE IF NOT EXISTS cost_records (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL,
    total_cost REAL NOT NULL,
    purchase_date TEXT NOT NULL,
    expiration_date TEXT,
    is_consumed INTEGER DEFAULT 0,
    consumed_date TEXT,
    wastage_reason TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (family_id) REFERENCES families(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 预算配置表
CREATE TABLE IF NOT EXISTS budget_configs (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
    amount REAL NOT NULL,
    category TEXT,
    alert_threshold REAL NOT NULL DEFAULT 0.8,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (family_id) REFERENCES families(id)
);

-- 智能采购计划表
CREATE TABLE IF NOT EXISTS purchasing_plans (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    time_horizon TEXT NOT NULL CHECK (time_horizon IN ('week', 'month', 'quarter')),
    total_budget REAL DEFAULT 0,
    estimated_cost REAL NOT NULL,
    savings_opportunity REAL DEFAULT 0,
    plan_data TEXT NOT NULL, -- JSON格式存储完整计划数据
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (family_id) REFERENCES families(id)
);

-- 数据分析报告表
CREATE TABLE IF NOT EXISTS analysis_reports (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('diet', 'cost', 'inventory', 'comprehensive')),
    time_range TEXT NOT NULL,
    report_data TEXT NOT NULL, -- JSON格式存储完整报告数据
    status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    generated_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (family_id) REFERENCES families(id),
    FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- 成本记录表索引
CREATE INDEX IF NOT EXISTS idx_cost_records_family ON cost_records(family_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_category ON cost_records(category);
CREATE INDEX IF NOT EXISTS idx_cost_records_purchase_date ON cost_records(purchase_date);
CREATE INDEX IF NOT EXISTS idx_cost_records_item_name ON cost_records(item_name);
CREATE INDEX IF NOT EXISTS idx_cost_records_family_date ON cost_records(family_id, purchase_date);

-- 预算配置表索引
CREATE INDEX IF NOT EXISTS idx_budget_configs_family ON budget_configs(family_id);
CREATE INDEX IF NOT EXISTS idx_budget_configs_active ON budget_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_budget_configs_category ON budget_configs(category);

-- 智能采购计划表索引
CREATE INDEX IF NOT EXISTS idx_purchasing_plans_family ON purchasing_plans(family_id);
CREATE INDEX IF NOT EXISTS idx_purchasing_plans_status ON purchasing_plans(status);
CREATE INDEX IF NOT EXISTS idx_purchasing_plans_created ON purchasing_plans(created_at);

-- 数据分析报告表索引
CREATE INDEX IF NOT EXISTS idx_analysis_reports_family ON analysis_reports(family_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_type ON analysis_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_status ON analysis_reports(status);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_created ON analysis_reports(created_at);