-- Selena's Elevate · D1 数据库 schema
--
-- 创建数据库后跑：
--   wrangler d1 execute selena-elevate-db --file=db/schema.sql --remote
-- 注意 --remote 是生产；不带是本地。

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  attempts_count INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  total_xp INTEGER DEFAULT 0,
  client_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_created
  ON snapshots (user_key, created_at DESC);
