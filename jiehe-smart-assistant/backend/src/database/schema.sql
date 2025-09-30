-- 数据库架构初始化脚本（SQLite）
-- 说明：使用 IF NOT EXISTS 以便可重复执行；开启外键由应用负责（PRAGMA foreign_keys = ON）

BEGIN TRANSACTION;

-- =====================
-- 基础用户与家庭结构
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT,
  avatar          TEXT,
  phone           TEXT,
  nickname        TEXT,
  gender          INTEGER DEFAULT 0,
  birthday        TEXT,
  preferences     TEXT, -- JSON
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  last_login_at   TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  is_deleted      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS families (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  avatar       TEXT,
  invite_code  TEXT NOT NULL UNIQUE,
  created_by   TEXT NOT NULL,
  settings     TEXT, -- JSON
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  is_active    INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS family_members (
  id           TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  role         TEXT NOT NULL, -- admin | member | child
  nickname     TEXT,
  permissions  TEXT, -- JSON
  joined_at    TEXT NOT NULL,
  is_active    INTEGER NOT NULL DEFAULT 1,
  UNIQUE(family_id, user_id),
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id)   REFERENCES users(id)    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user   ON family_members(user_id);

-- =====================
-- 留言与通知
-- =====================
CREATE TABLE IF NOT EXISTS message_categories (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  icon        TEXT,
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS family_messages (
  id            TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL,
  category_id   TEXT,
  author_id     TEXT NOT NULL,
  title         TEXT,
  content       TEXT NOT NULL,
  message_type  TEXT NOT NULL DEFAULT 'text',
  attachments   TEXT, -- JSON
  priority      INTEGER NOT NULL DEFAULT 2,
  is_pinned     INTEGER NOT NULL DEFAULT 0,
  parent_id     TEXT,
  mentions      TEXT, -- JSON
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  is_deleted    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(family_id)  REFERENCES families(id)         ON DELETE CASCADE,
  FOREIGN KEY(category_id)REFERENCES message_categories(id)ON DELETE SET NULL,
  FOREIGN KEY(author_id)  REFERENCES users(id)            ON DELETE CASCADE,
  FOREIGN KEY(parent_id)  REFERENCES family_messages(id)  ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_family_messages_family ON family_messages(family_id);
CREATE INDEX IF NOT EXISTS idx_family_messages_author ON family_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_family_messages_created ON family_messages(created_at);

CREATE TABLE IF NOT EXISTS message_read_status (
  id          TEXT PRIMARY KEY,
  message_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  read_at     TEXT NOT NULL,
  UNIQUE(message_id, user_id),
  FOREIGN KEY(message_id) REFERENCES family_messages(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id)    REFERENCES users(id)           ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  family_id      TEXT,
  title          TEXT,
  content        TEXT,
  type           TEXT,
  reference_type TEXT,
  reference_id   TEXT,
  created_at     TEXT NOT NULL,
  FOREIGN KEY(user_id)   REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE
);

-- 兼容 FamilyReportService 统计用：创建与 family_messages 对应的只读视图
DROP VIEW IF EXISTS messages;
CREATE VIEW messages AS
  SELECT id, family_id, created_at FROM family_messages WHERE is_deleted = 0;

-- =====================
-- 日历
-- =====================
CREATE TABLE IF NOT EXISTS calendar_events (
  id               TEXT PRIMARY KEY,
  family_id        TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  start_time       TEXT NOT NULL,
  end_time         TEXT NOT NULL,
  location         TEXT,
  event_type       TEXT NOT NULL DEFAULT 'other',
  priority         TEXT NOT NULL DEFAULT 'medium',
  is_all_day       INTEGER NOT NULL DEFAULT 0,
  recurrence_rule  TEXT,
  created_by       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'planned',
  visibility       TEXT NOT NULL DEFAULT 'family',
  color            TEXT NOT NULL DEFAULT '#1890ff',
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by)REFERENCES users(id)    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calendar_family ON calendar_events(family_id);
CREATE INDEX IF NOT EXISTS idx_calendar_times  ON calendar_events(start_time, end_time);

CREATE TABLE IF NOT EXISTS calendar_event_participants (
  id                   TEXT PRIMARY KEY,
  event_id             TEXT NOT NULL,
  user_id              TEXT NOT NULL,
  participation_status TEXT NOT NULL DEFAULT 'invited',
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  UNIQUE(event_id, user_id),
  FOREIGN KEY(event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id)  REFERENCES users(id)          ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calendar_reminders (
  id                    TEXT PRIMARY KEY,
  event_id              TEXT NOT NULL,
  reminder_type         TEXT NOT NULL DEFAULT 'notification',
  remind_before_minutes INTEGER NOT NULL DEFAULT 15,
  message               TEXT,
  is_sent               INTEGER NOT NULL DEFAULT 0,
  recipient_id          TEXT,
  created_at            TEXT NOT NULL,
  FOREIGN KEY(event_id)   REFERENCES calendar_events(id) ON DELETE CASCADE,
  FOREIGN KEY(recipient_id)REFERENCES users(id)          ON DELETE SET NULL
);

-- =====================
-- 菜单与投票
-- =====================
CREATE TABLE IF NOT EXISTS menus (
  id               TEXT PRIMARY KEY,
  family_id        TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  menu_date        TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',
  voting_deadline  TEXT,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  is_active        INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by)REFERENCES users(id)    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dishes (
  id               TEXT PRIMARY KEY,
  menu_id          TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL,
  estimated_time   INTEGER,
  difficulty_level INTEGER NOT NULL DEFAULT 1,
  ingredients      TEXT, -- JSON
  recipe_url       TEXT,
  image_url        TEXT,
  estimated_price  REAL,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  is_active        INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(menu_id)   REFERENCES menus(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by)REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_votes (
  id         TEXT PRIMARY KEY,
  menu_id    TEXT NOT NULL,
  dish_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  vote_type  TEXT NOT NULL, -- like | dislike | neutral
  priority   INTEGER NOT NULL DEFAULT 0,
  notes      TEXT,
  voted_at   TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  UNIQUE(menu_id, dish_id, user_id),
  FOREIGN KEY(menu_id) REFERENCES menus(id)  ON DELETE CASCADE,
  FOREIGN KEY(dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id)  ON DELETE CASCADE
);

-- 兼容早期分析服务的数据表（只做最小字段以避免运行期报错）
CREATE TABLE IF NOT EXISTS menu_voting (
  id               TEXT PRIMARY KEY,
  family_id        TEXT NOT NULL,
  menu_id          TEXT,
  status           TEXT,
  created_at       TEXT NOT NULL,
  voting_end_time  TEXT
);

CREATE TABLE IF NOT EXISTS menu_dishes (
  id                TEXT PRIMARY KEY,
  menu_id           TEXT NOT NULL,
  dish_name         TEXT NOT NULL,
  category          TEXT,
  estimated_cost    REAL,
  difficulty        INTEGER,
  nutritional_info  TEXT -- JSON
);

CREATE TABLE IF NOT EXISTS menu_voting_results (
  id         TEXT PRIMARY KEY,
  voting_id  TEXT NOT NULL,
  dish_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  vote_type  TEXT NOT NULL,
  priority   INTEGER NOT NULL DEFAULT 0
);

-- =====================
-- 任务
-- =====================
CREATE TABLE IF NOT EXISTS tasks (
  id                TEXT PRIMARY KEY,
  family_id         TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  category          TEXT,
  priority          INTEGER NOT NULL DEFAULT 2,
  status            TEXT NOT NULL DEFAULT 'pending',
  assigned_to       TEXT,
  created_by        TEXT NOT NULL,
  due_date          TEXT,
  completed_at      TEXT,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  actual_minutes    INTEGER,
  recurrence_rule   TEXT, -- JSON
  tags              TEXT,
  attachments       TEXT, -- JSON
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(family_id)  REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY(assigned_to)REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY(created_by) REFERENCES users(id)    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_family ON tasks(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- =====================
-- 库存与食材（两套模型并存以兼容不同服务）
-- =====================
-- A. Inventory.ts 使用的食材与库存表
CREATE TABLE IF NOT EXISTS food_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  icon       TEXT,
  color      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS food_items (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  category_id          TEXT NOT NULL,
  barcode              TEXT,
  unit                 TEXT NOT NULL,
  default_expire_days  INTEGER NOT NULL DEFAULT 7,
  nutrition_info       TEXT, -- JSON
  image                TEXT,
  description          TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  is_active            INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(category_id) REFERENCES food_categories(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id             TEXT PRIMARY KEY,
  family_id      TEXT NOT NULL,
  -- 旧模型字段（供 SmartPurchasing/DietAnalysis 使用）
  name           TEXT,
  category       TEXT,
  min_stock_level REAL,
  deleted_at     TEXT,
  -- 新模型字段（供 Inventory.ts 使用）
  food_item_id   TEXT,
  batch_number   TEXT,
  quantity       REAL,
  unit           TEXT,
  purchase_date  TEXT,
  expire_date    TEXT,
  purchase_price REAL,
  location       TEXT,
  status         TEXT,
  notes          TEXT,
  added_by       TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  consumed_at    TEXT,
  FOREIGN KEY(food_item_id) REFERENCES food_items(id),
  FOREIGN KEY(added_by)     REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_family ON inventory(family_id);

-- B. SmartShoppingService 使用的库存项与批次表
CREATE TABLE IF NOT EXISTS inventory_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  icon       TEXT,
  color      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id             TEXT PRIMARY KEY,
  family_id      TEXT NOT NULL,
  name           TEXT NOT NULL,
  category_id    TEXT,
  barcode        TEXT,
  unit           TEXT,
  minimum_stock  REAL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1,
  is_deleted     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT,
  updated_at     TEXT,
  FOREIGN KEY(category_id) REFERENCES inventory_categories(id)
);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id                 TEXT PRIMARY KEY,
  -- 两种关联方式兼容
  inventory_id       TEXT, -- 旧模型：关联 inventory
  item_id            TEXT, -- 新模型：关联 inventory_items
  quantity           REAL,
  consumed_quantity  REAL DEFAULT 0,
  remaining_quantity REAL,
  cost_per_unit      REAL,
  expiration_date    TEXT, -- 旧模型字段名
  expire_date        TEXT, -- 新模型字段名
  created_at         TEXT,
  updated_at         TEXT,
  consumed_at        TEXT,
  FOREIGN KEY(inventory_id) REFERENCES inventory(id)         ON DELETE CASCADE,
  FOREIGN KEY(item_id)      REFERENCES inventory_items(id)   ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inv_batches_inventory ON inventory_batches(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inv_batches_item      ON inventory_batches(item_id);

-- =====================
-- 费用、预算与报表
-- =====================
CREATE TABLE IF NOT EXISTS ai_budget_records (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  family_id    TEXT NOT NULL,
  request_type TEXT NOT NULL,
  tokens       INTEGER NOT NULL,
  cost         REAL NOT NULL,
  request_id   TEXT,
  created_at   TEXT NOT NULL,
  FOREIGN KEY(user_id)   REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budget_configs (
  id              TEXT PRIMARY KEY,
  family_id       TEXT NOT NULL,
  period          TEXT NOT NULL, -- daily | weekly | monthly
  amount          REAL NOT NULL,
  category        TEXT,
  alert_threshold REAL NOT NULL DEFAULT 0.8,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cost_records (
  id              TEXT PRIMARY KEY,
  family_id       TEXT NOT NULL,
  item_name       TEXT NOT NULL,
  category        TEXT,
  quantity        REAL NOT NULL,
  unit            TEXT NOT NULL,
  unit_price      REAL NOT NULL,
  total_cost      REAL NOT NULL,
  purchase_date   TEXT NOT NULL,
  expiration_date TEXT,
  is_consumed     INTEGER NOT NULL DEFAULT 0,
  consumed_date   TEXT,
  wastage_reason  TEXT,
  created_by      TEXT NOT NULL,
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id)    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchasing_plans (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT NOT NULL,
  time_horizon        TEXT NOT NULL,
  total_budget        REAL,
  estimated_cost      REAL,
  savings_opportunity REAL,
  plan_data           TEXT NOT NULL, -- JSON
  created_at          TEXT NOT NULL,
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_reports (
  id           TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL,
  report_type  TEXT NOT NULL,
  time_range   TEXT NOT NULL,
  report_data  TEXT NOT NULL, -- JSON
  status       TEXT,
  generated_by TEXT,
  created_at   TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE
);

COMMIT;

