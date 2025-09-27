-- 家和智能助手数据库表结构设计
-- 创建时间: 2025-09-26
-- 数据库类型: SQLite
-- 启用WAL模式和外键约束

-- 启用WAL模式和外键约束
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA secure_delete = ON;

-- =====================================
-- 用户管理表
-- =====================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    avatar TEXT,
    phone TEXT,
    nickname TEXT,
    gender INTEGER DEFAULT 0, -- 0:未知, 1:男, 2:女
    birthday DATE,
    preferences TEXT, -- JSON格式存储用户偏好
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    is_deleted BOOLEAN DEFAULT 0,
    
    CHECK (gender IN (0, 1, 2)),
    CHECK (email LIKE '%@%')
);

-- 创建用户表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);-- 家庭表
CREATE TABLE IF NOT EXISTS families (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    avatar TEXT,
    invite_code TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL,
    settings TEXT, -- JSON格式存储家庭设置
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建家庭表索引
CREATE INDEX IF NOT EXISTS idx_families_invite_code ON families(invite_code);
CREATE INDEX IF NOT EXISTS idx_families_created_by ON families(created_by);

-- 家庭成员关系表
CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    family_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- admin, member, child
    nickname TEXT,
    permissions TEXT, -- JSON格式存储权限
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(family_id, user_id),
    CHECK (role IN ('admin', 'member', 'child'))
);

-- 创建家庭成员表索引
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);-- =====================================
-- 任务管理表
-- =====================================

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general', -- cleaning, cooking, shopping, maintenance, etc.
    priority INTEGER DEFAULT 2, -- 1:高 2:中 3:低
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    assigned_to TEXT,
    created_by TEXT NOT NULL,
    due_date DATETIME,
    completed_at DATETIME,
    estimated_minutes INTEGER DEFAULT 30,
    actual_minutes INTEGER,
    recurrence_rule TEXT, -- JSON格式存储重复规则
    tags TEXT, -- 逗号分隔的标签
    attachments TEXT, -- JSON格式存储附件信息
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT 0,
    
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (priority IN (1, 2, 3)),
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- 创建任务表索引
CREATE INDEX IF NOT EXISTS idx_tasks_family_id ON tasks(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);-- =====================================
-- 智能库存管理表
-- =====================================

-- 食材分类表
CREATE TABLE IF NOT EXISTS food_categories (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1
);

-- 食材基础信息表
CREATE TABLE IF NOT EXISTS food_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    barcode TEXT,
    unit TEXT DEFAULT 'kg', -- kg, g, L, ml, 个, 包, 盒, 瓶等
    default_expire_days INTEGER DEFAULT 7,
    nutrition_info TEXT, -- JSON格式营养信息
    image TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    
    FOREIGN KEY (category_id) REFERENCES food_categories(id),
    CHECK (unit IN ('kg', 'g', 'L', 'ml', '个', '包', '盒', '瓶', '袋', '只', '根', '片'))
);

-- 创建食材表索引
CREATE INDEX IF NOT EXISTS idx_food_items_category_id ON food_items(category_id);
CREATE INDEX IF NOT EXISTS idx_food_items_barcode ON food_items(barcode);
CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items(name);-- 库存表（支持多批次）
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    family_id TEXT NOT NULL,
    food_item_id TEXT NOT NULL,
    batch_number TEXT, -- 批次号，支持同一食材多个批次
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    purchase_date DATE DEFAULT (date('now')),
    expire_date DATE,
    purchase_price DECIMAL(10,2),
    location TEXT DEFAULT '冰箱', -- 冰箱、冷冻室、储藏室、厨房等
    status TEXT DEFAULT 'available', -- available, expired, consumed
    notes TEXT,
    added_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    consumed_at DATETIME,
    
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (food_item_id) REFERENCES food_items(id),
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (quantity >= 0),
    CHECK (status IN ('available', 'expired', 'consumed', 'running_low'))
);

-- 创建库存表索引
CREATE INDEX IF NOT EXISTS idx_inventory_family_id ON inventory(family_id);
CREATE INDEX IF NOT EXISTS idx_inventory_food_item_id ON inventory(food_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expire_date ON inventory(expire_date);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location);-- =====================================
-- 点菜系统表
-- =====================================

-- 菜谱表
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'home_cooking', -- home_cooking, soup, dessert, etc.
    difficulty INTEGER DEFAULT 2, -- 1:简单 2:中等 3:困难
    prep_time INTEGER DEFAULT 30, -- 准备时间（分钟）
    cook_time INTEGER DEFAULT 30, -- 烹饪时间（分钟）
    servings INTEGER DEFAULT 4, -- 份量
    ingredients TEXT, -- JSON格式存储食材列表
    steps TEXT, -- JSON格式存储制作步骤
    nutrition TEXT, -- JSON格式存储营养信息
    image TEXT,
    tags TEXT, -- 逗号分隔的标签
    source TEXT, -- 菜谱来源
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CHECK (difficulty IN (1, 2, 3)),
    CHECK (servings > 0)
);

-- 创建菜谱表索引
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_difficulty ON recipes(difficulty);
CREATE INDEX IF NOT EXISTS idx_recipes_prep_time ON recipes(prep_time);

-- 家庭菜单表
CREATE TABLE IF NOT EXISTS family_menus (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    family_id TEXT NOT NULL,
    date DATE NOT NULL,
    meal_type TEXT NOT NULL, -- breakfast, lunch, dinner, snack
    title TEXT,
    description TEXT,
    created_by TEXT NOT NULL,
    voting_deadline DATETIME,
    status TEXT DEFAULT 'voting', -- voting, confirmed, completed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    CHECK (status IN ('voting', 'confirmed', 'completed')),
    UNIQUE(family_id, date, meal_type)
);

-- 创建家庭菜单表索引
CREATE INDEX IF NOT EXISTS idx_family_menus_family_id ON family_menus(family_id);
CREATE INDEX IF NOT EXISTS idx_family_menus_date ON family_menus(date);
CREATE INDEX IF NOT EXISTS idx_family_menus_status ON family_menus(status);-- 菜单选项表
CREATE TABLE IF NOT EXISTS menu_options (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    menu_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    suggested_by TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (menu_id) REFERENCES family_menus(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (suggested_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(menu_id, recipe_id)
);

-- 菜单投票表（与模型一致）
CREATE TABLE IF NOT EXISTS menu_votes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    menu_id TEXT NOT NULL,
    dish_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT NOT NULL DEFAULT 'like', -- like, dislike, neutral
    priority INTEGER DEFAULT 1,
    notes TEXT,
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
    FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (vote_type IN ('like', 'dislike', 'neutral')),
    UNIQUE(dish_id, user_id)
);-- =====================================
-- 共享日历表
-- =====================================

-- 日历事件表
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT DEFAULT 'general', -- general, task, meal, reminder, etc.
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    all_day BOOLEAN DEFAULT 0,
    location TEXT,
    color TEXT DEFAULT '#1890ff',
    recurrence_rule TEXT, -- JSON格式存储重复规则
    reminder_times TEXT, -- JSON格式存储提醒时间
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT 0,
    
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (start_time < end_time OR end_time IS NULL)
);

-- 兼容模型所需的菜单/菜品/投票表（与 family_menus/recipes/menu_options 并存，供 Menu 模型使用）
CREATE TABLE IF NOT EXISTS menus (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    menu_date DATE NOT NULL,
    status TEXT DEFAULT 'draft',
    voting_deadline DATETIME,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_menus_family_date ON menus(family_id, menu_date);
CREATE INDEX IF NOT EXISTS idx_menus_status2 ON menus(status);

CREATE TABLE IF NOT EXISTS dishes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    menu_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    estimated_time INTEGER,
    difficulty_level INTEGER DEFAULT 1,
    ingredients TEXT,
    recipe_url TEXT,
    image_url TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dishes_menu ON dishes(menu_id);

CREATE TABLE IF NOT EXISTS menu_votes_compat (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    menu_id TEXT NOT NULL,
    dish_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT DEFAULT 'like',
    priority INTEGER DEFAULT 1,
    notes TEXT,
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
    FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(dish_id, user_id)
);

-- 创建日历事件表索引
CREATE INDEX IF NOT EXISTS idx_calendar_events_family_id ON calendar_events(family_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON calendar_events(event_type);-- 事件参与者表
CREATE TABLE IF NOT EXISTS event_participants (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'invited', -- invited, accepted, declined, maybe
    response_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (status IN ('invited', 'accepted', 'declined', 'maybe')),
    UNIQUE(event_id, user_id)
);

-- =====================================
-- 家庭留言板表
-- =====================================

-- 留言分类表
CREATE TABLE IF NOT EXISTS message_categories (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    family_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT DEFAULT '#1890ff',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    UNIQUE(family_id, name)
);-- 家庭留言表
CREATE TABLE IF NOT EXISTS family_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    family_id TEXT NOT NULL,
    category_id TEXT,
    author_id TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- text, image, audio, video, file
    attachments TEXT, -- JSON格式存储附件信息
    priority INTEGER DEFAULT 2, -- 1:高 2:中 3:低
    is_pinned BOOLEAN DEFAULT 0,
    parent_id TEXT, -- 回复消息的父消息ID
    mentions TEXT, -- JSON格式存储@提醒的用户ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT 0,
    
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES message_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES family_messages(id) ON DELETE CASCADE,
    CHECK (priority IN (1, 2, 3)),
    CHECK (message_type IN ('text', 'image', 'audio', 'video', 'file'))
);

-- 创建留言表索引
CREATE INDEX IF NOT EXISTS idx_family_messages_family_id ON family_messages(family_id);
CREATE INDEX IF NOT EXISTS idx_family_messages_author_id ON family_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_family_messages_created_at ON family_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_family_messages_parent_id ON family_messages(parent_id);-- 消息阅读状态表
CREATE TABLE IF NOT EXISTS message_read_status (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES family_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id)
);

-- =====================================
-- 通知系统表
-- =====================================

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    family_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL, -- task_assigned, inventory_expired, message_mentioned, etc.
    reference_type TEXT, -- task, inventory, message, event
    reference_id TEXT, -- 关联对象的ID
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);-- 创建通知表索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_family_id ON notifications(family_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- =====================================
-- 系统配置和日志表
-- =====================================

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    category TEXT DEFAULT 'general',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    family_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_data TEXT, -- JSON格式
    new_data TEXT, -- JSON格式
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL
);

-- 创建操作日志表索引
CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_family_id ON operation_logs(family_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_action ON operation_logs(action);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);-- =====================================
-- 初始化基础数据
-- =====================================

-- 插入默认食材分类
INSERT OR IGNORE INTO food_categories (id, name, icon, color, sort_order) VALUES
('cat_vegetables', '蔬菜', '🥬', '#52c41a', 1),
('cat_fruits', '水果', '🍎', '#fa8c16', 2),
('cat_meat', '肉类', '🥩', '#f5222d', 3),
('cat_seafood', '海鲜', '🐟', '#13c2c2', 4),
('cat_dairy', '奶制品', '🥛', '#722ed1', 5),
('cat_grains', '谷物', '🌾', '#d4b106', 6),
('cat_condiments', '调料', '🧂', '#8c8c8c', 7),
('cat_beverages', '饮料', '🥤', '#1890ff', 8),
('cat_snacks', '零食', '🍪', '#eb2f96', 9),
('cat_frozen', '冷冻食品', '🧊', '#096dd9', 10);

-- 插入默认系统配置
INSERT OR IGNORE INTO system_configs (key, value, description, category) VALUES
('inventory_expire_remind_days', '3', '库存过期提醒提前天数', 'inventory'),
('inventory_low_stock_threshold', '0.2', '库存不足阈值比例', 'inventory'),
('ai_budget_monthly_limit', '100', 'AI服务月度预算限制（元）', 'ai'),
('file_upload_max_size', '10485760', '文件上传最大大小（字节）', 'file'),
('session_timeout', '86400', '用户会话超时时���（秒）', 'auth'),
('notification_batch_size', '50', '通知批量处理大小', 'notification');

-- 插入默认留言分类（将在家庭创建时自动生成）
-- 这些是模板，实际使用时会根据family_id创建对应记录

-- 数据库架构创建完成
-- 总表数: 22个核心表
-- 功能覆盖: 用户管理、家庭管理、任务分配、库存管理、点菜系统、共享日历、留言板、通知系统
-- 索引优化: 已为关键查询字段创建索引
-- 约束完整: 外键约束、检查约束、唯一约束齐全
