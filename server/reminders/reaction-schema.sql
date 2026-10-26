CREATE TABLE IF NOT EXISTS reaction_notifications (
  event_key TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reaction_notification_actor_time ON reaction_notifications(actor,created_at);
