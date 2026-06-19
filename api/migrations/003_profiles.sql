CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
