# Hive

Desktop AI agent orchestrator. Manages parallel coding agents across git worktrees with a code review workflow.

## Setup

```bash
bun install
bun run db:migrate
```

## Development

```bash
bun run electron:dev
```

## Database

The app uses SQLite via `better-sqlite3` and `drizzle-orm`. The database file is stored at `~/.local/share/hive/hive.db`.

After modifying the schema in `server/database/schema.ts`, generate and apply a new migration:

```bash
bun run db:generate
bun run db:migrate
```

## Build

```bash
bun run electron:build
```
