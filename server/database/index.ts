import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { join } from "path";
import { mkdirSync } from "fs";

const dataDir = join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".local",
  "share",
  "hive",
);

mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(join(dataDir, "hive.db"));
sqlite.pragma("journal_mode = WAL");

// Auto-create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    path text NOT NULL,
    pkg_manager text,
    dev_command text,
    install_command text,
    config_override text,
    created_at integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS worktrees (
    id text PRIMARY KEY NOT NULL,
    project_id text NOT NULL REFERENCES projects(id),
    branch_name text NOT NULL,
    path text NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    opencode_port integer,
    opencode_pid integer,
    dev_server_active integer DEFAULT 0 NOT NULL,
    linear_issue_id text,
    linear_issue_identifier text,
    created_at integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id text PRIMARY KEY NOT NULL,
    worktree_id text REFERENCES worktrees(id),
    opencode_session_id text,
    role text NOT NULL,
    status text DEFAULT 'idle' NOT NULL,
    created_at integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS signals (
    id text PRIMARY KEY NOT NULL,
    session_id text NOT NULL REFERENCES sessions(id),
    type text NOT NULL,
    content text NOT NULL,
    options text,
    resolved integer DEFAULT 0 NOT NULL,
    resolved_content text,
    created_at integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id text PRIMARY KEY NOT NULL,
    worktree_id text NOT NULL REFERENCES worktrees(id),
    worker_session_id text,
    reviewer_session_id text,
    iteration integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'agent_review' NOT NULL,
    summary text,
    created_at integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS review_comments (
    id text PRIMARY KEY NOT NULL,
    review_id text NOT NULL REFERENCES reviews(id),
    file_path text NOT NULL,
    line_number integer,
    side text,
    author text NOT NULL,
    content text NOT NULL,
    resolved integer DEFAULT 0 NOT NULL,
    created_at integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS change_comments (
    id text PRIMARY KEY NOT NULL,
    project_id text NOT NULL REFERENCES projects(id),
    session_id text,
    file_path text NOT NULL,
    start_line integer NOT NULL,
    end_line integer NOT NULL,
    side text,
    content text NOT NULL,
    resolved integer DEFAULT 0 NOT NULL,
    created_at integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dev_profile (
    id text PRIMARY KEY NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    category text NOT NULL,
    created_at integer NOT NULL
  );
`);

export const db = drizzle(sqlite, { schema });
