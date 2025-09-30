import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

// 启用详细模式（开发环境）
if (process.env.NODE_ENV === 'development') {
  sqlite3.verbose();
}

// 数据库配置
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../database/jiehe.db');
const DB_DIR = path.dirname(DB_PATH);

// 数据库连接实例
let db: sqlite3.Database | null = null;

/**
 * 确保数据库目录存在
 */
function ensureDatabaseDirectory(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    logger.info(`创建数据库目录: ${DB_DIR}`);
  }
}

/**
 * 执行SQL文件
 */
function executeSqlFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('数据库连接未初始化'));
      return;
    }

    if (!fs.existsSync(filePath)) {
      reject(new Error(`SQL文件不存在: ${filePath}`));
      return;
    }

    const sql = fs.readFileSync(filePath, 'utf-8');
    
    db.exec(sql, (error) => {
      if (error) {
        logger.error(`执行SQL文件失败 ${filePath}:`, error);
        reject(error);
      } else {
        logger.info(`成功执行SQL文件: ${filePath}`);
        resolve();
      }
    });
  });
}/**
 * 初始化数据库连接
 */
export async function initDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    try {
      ensureDatabaseDirectory();

      db = new sqlite3.Database(DB_PATH, (error) => {
        // 设置全局 busyTimeout，避免并发写入出现 SQLITE_BUSY
        try { (db as any).configure?.('busyTimeout', 5000); } catch {}
        if (error) {
          logger.error('数据库连接失败:', error);
          reject(error);
        } else {
          logger.info(`数据库连接成功: ${DB_PATH}`);
          
          // 配置数据库
          configureDatabase()
            .then(() => initializeSchema())
            .then(() => {
              logger.info('数据库初始化完成');
              resolve(db!);
            })
            .catch(reject);
        }
      });
    } catch (error) {
      logger.error('数据库初始化失败:', error);
      reject(error);
    }
  });
}

/**
 * 配置数据库
 */
async function configureDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('数据库连接未初始化'));
      return;
    }

    // 启用WAL模式
    db.run('PRAGMA journal_mode = WAL;', (error) => {
      if (error) {
        logger.error('启用WAL模式失败:', error);
        reject(error);
        return;
      }

      // 启用外键约束
      db!.run('PRAGMA foreign_keys = ON;', (error) => {
        if (error) {
          logger.error('启用外键约束失败:', error);
          reject(error);
          return;
        }

        // 设置同步模式
        db!.run('PRAGMA synchronous = NORMAL;', (error) => {
          if (error) {
            logger.error('设置同步模式失败:', error);
            reject(error);
            return;
          }

          logger.info('数据库配置完成');
          resolve();
        });
      });
    });
  });
}

/**
 * 确认列是否存在，不存在则添加
 */
async function ensureColumnExists(table: string, column: string, definition: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('数据库连接未初始化'));

    db.all(`PRAGMA table_info(${table});`, [], (err, rows: any[]) => {
      if (err) return reject(err);
      const exists = rows?.some((r: any) => r.name === column);
      if (exists) return resolve();

      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`, [], (alterErr) => {
        if (alterErr) {
          logger.error(`为表 ${table} 添加列 ${column} 失败:`, alterErr);
          return reject(alterErr);
        }
        logger.info(`已为表 ${table} 添加列: ${column}`);
        resolve();
      });
    });
  });
}

/**
 * 初始化数据库架构
 */
function resolveSchemaPath(): string {
  const envPath = process.env.DATABASE_SCHEMA_PATH;
  const candidates = [
    envPath,
    path.resolve(process.cwd(), 'database/schema.sql'),
    path.resolve(process.cwd(), 'src/database/schema.sql'),
    path.resolve(__dirname, '../database/schema.sql'),
    path.resolve(__dirname, '../../database/schema.sql'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`未找到数据库schema.sql，请设置 DATABASE_SCHEMA_PATH 或将文件放在 src/database/schema.sql`);
}

async function initializeSchema(): Promise<void> {
  try {
    const schemaPath = resolveSchemaPath();
    await executeSqlFile(schemaPath);

    // 运行时增量升级：为已有库补充新列
    await ensureColumnExists('food_items', 'min_stock_threshold', 'INTEGER DEFAULT 0');

    logger.info('数据库架构初始化完成');
  } catch (error) {
    logger.error('数据库架构初始化失败:', error);
    throw error;
  }
}

/**
 * 获取数据库连接
 */
export function getDatabase(): sqlite3.Database {
  if (!db) {
    throw new Error('数据库连接未初始化，请先调用 initDatabase()');
  }
  return db;
}

/**
 * 执行查询（返回单行）
 */
export function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('数据库连接未初始化'));
      return;
    }

    db.get(sql, params, (error, row) => {
      if (error) {
        logger.error('查询执行失败:', { sql, params, error });
        reject(error);
      } else {
        resolve(row as T);
      }
    });
  });
}

/**
 * 执行查询（返回多行）
 */
export function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('数据库连接未初始化'));
      return;
    }

    db.all(sql, params, (error, rows) => {
      if (error) {
        logger.error('查询执行失败:', { sql, params, error });
        reject(error);
      } else {
        resolve(rows as T[]);
      }
    });
  });
}/**
 * 执行更新操作（INSERT、UPDATE、DELETE）
 */
export function dbRun(sql: string, params: any[] = []): Promise<{ lastID?: number; changes: number }> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('数据库连接未初始化'));
      return;
    }

    db.run(sql, params, function(error) {
      if (error) {
        logger.error('更新操作执行失败:', { sql, params, error });
        reject(error);
      } else {
        resolve({
          lastID: this.lastID,
          changes: this.changes,
        });
      }
    });
  });
}

/**
 * 开始事务
 */
export function beginTransaction(): Promise<void> {
  return dbRun('BEGIN TRANSACTION').then(() => {});
}

/**
 * 提交事务
 */
export function commitTransaction(): Promise<void> {
  return dbRun('COMMIT').then(() => {});
}

/**
 * 回滚事务
 */
export function rollbackTransaction(): Promise<void> {
  return dbRun('ROLLBACK').then(() => {});
}

/**
 * 执行事务
 */
export async function executeInTransaction<T>(
  operation: () => Promise<T>
): Promise<T> {
  await beginTransaction();
  
  try {
    const result = await operation();
    await commitTransaction();
    return result;
  } catch (error) {
    await rollbackTransaction();
    throw error;
  }
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    db.close((error) => {
      if (error) {
        logger.error('关闭数据库连接失败:', error);
        reject(error);
      } else {
        logger.info('数据库连接已关闭');
        db = null;
        resolve();
      }
    });
  });
}

/**
 * DatabaseManager类，提供单例模式的数据库管理
 */
export class DatabaseManager {
  private static instance: DatabaseManager;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public getDatabase(): sqlite3.Database {
    return getDatabase();
  }

  public async initialize(): Promise<sqlite3.Database> {
    return initDatabase();
  }

  public async close(): Promise<void> {
    return closeDatabase();
  }
}
