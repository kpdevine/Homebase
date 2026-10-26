CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  subscription TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  last_sent_date TEXT,
  last_attempt_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS devices_user ON devices(uid);
CREATE TABLE IF NOT EXISTS day_status (
  uid TEXT NOT NULL,
  date TEXT NOT NULL,
  logged INTEGER NOT NULL,
  observed_at INTEGER NOT NULL,
  PRIMARY KEY(uid,date)
);
CREATE TABLE IF NOT EXISTS reaction_notifications (
  event_key TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reaction_notification_actor_time ON reaction_notifications(actor,created_at);
