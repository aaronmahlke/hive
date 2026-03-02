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

export const db = drizzle(sqlite, { schema });
