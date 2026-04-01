# D1 Database Schema — construye.lat

## Tablas

### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id INTEGER NOT NULL UNIQUE,
  github_login TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_github_id ON users(github_id);
```

### projects
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  repo_url TEXT,
  root_path TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_projects_user ON projects(user_id);
```

### sessions
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',
  mode TEXT NOT NULL DEFAULT 'interactive',
  model TEXT NOT NULL,
  messages_json TEXT NOT NULL DEFAULT '[]',
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  turns INTEGER NOT NULL DEFAULT 0,
  parent_session_id TEXT REFERENCES sessions(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
```

### usage
```sql
CREATE TABLE usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_usage_user ON usage(user_id);
CREATE INDEX idx_usage_session ON usage(session_id);
CREATE INDEX idx_usage_date ON usage(created_at);
```

### api_keys
```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

## Notas D1
- No hay BOOLEAN nativo: usar INTEGER (0/1)
- No hay DATETIME nativo: usar TEXT con ISO 8601
- Foreign keys siempre enforced
- Límite de 100 bound parameters por query
- JSON almacenado como TEXT
