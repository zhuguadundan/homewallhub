// 简单的数据库路径迁移脚本：将 src/database/jiehe.db 复制到 DATABASE_PATH（或默认 backend/database）
// 使用方法：在 backend 目录下执行 `npm run db:migrate-path`

const fs = require('fs');
const path = require('path');

function log(msg, obj) {
  if (obj) {
    console.log(`[db-migrate] ${msg}`, obj);
  } else {
    console.log(`[db-migrate] ${msg}`);
  }
}

try {
  const backendRoot = path.join(__dirname, '..');

  const oldDb = path.join(backendRoot, 'src', 'database', 'jiehe.db');
  const oldWal = oldDb + '-wal';
  const oldShm = oldDb + '-shm';

  const envTarget = process.env.DATABASE_PATH;
  const targetDb = envTarget
    ? (path.isAbsolute(envTarget) ? envTarget : path.join(backendRoot, envTarget))
    : path.join(backendRoot, 'database', 'jiehe.db');
  const targetWal = targetDb + '-wal';
  const targetShm = targetDb + '-shm';
  const targetDir = path.dirname(targetDb);

  log(`old DB: ${oldDb}`);
  log(`target DB: ${targetDb}`);

  if (fs.existsSync(targetDb)) {
    log('目标数据库已存在，跳过复制。');
    process.exit(0);
  }

  if (!fs.existsSync(oldDb)) {
    log('未发现旧数据库，无需迁移。');
    process.exit(0);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(oldDb, targetDb);
  log('已复制主数据库文件。');

  if (fs.existsSync(oldWal)) {
    try {
      fs.copyFileSync(oldWal, targetWal);
      log('已复制 -wal 文件。');
    } catch {}
  }
  if (fs.existsSync(oldShm)) {
    try {
      fs.copyFileSync(oldShm, targetShm);
      log('已复制 -shm 文件。');
    } catch {}
  }

  log('数据库路径迁移完成。');
} catch (e) {
  console.error('[db-migrate] 迁移失败：', e);
  process.exit(1);
}

