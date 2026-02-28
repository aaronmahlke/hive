# Hive - Project Plan

## What is Hive

An AI development orchestrator. A standalone Tauri v2 + Nuxt 4 desktop app that manages multiple OpenCode agents working in parallel across git worktrees, with a review-before-commit workflow.

You talk to a main "technical PM" agent that delegates work to sub-agents, each in their own worktree. Workers signal questions/completion via a custom MCP tool. Review agents check work before presenting it to you with a diff UI.

## Stack

| Layer | Tech |
|---|---|
| Desktop | Tauri v2 (macOS overlay titlebar) |
| Frontend | Nuxt 4 (SPA, `ssr: false`) |
| Styling | Tailwind CSS v4 + OKLCH seed-based design system (from zeitwerk) |
| UI primitives | reka-ui |
| Icons | @heroicons/vue (16/solid, 20/solid) |
| Diff rendering | @pierre/diffs |
| Markdown | marked + marked-shiki + shiki (custom "hive" theme) + dompurify |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| OpenCode | @opencode-ai/sdk + `opencode serve` HTTP API |
| MCP | @modelcontextprotocol/sdk (signal tool for worker-to-orchestrator communication) |
| Git | simple-git |
| Process mgmt | Node child_process (opencode serve, dev servers) |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      TAURI v2 WINDOW                          │
│                                                              │
│  ┌─ Titlebar ──────────────────────────────────────────────┐ │
│  │ [traffic lights] [tabs] [+]              [search] [⚙]  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Sidebar ─────┐  ┌─ Main Content ──────────────────────┐ │
│  │ Worktrees     │  │ ┌─ Header ────────────────────────┐ │ │
│  │ ├ main     ●  │  │ │ project-name   [bun] [:4101]   │ │ │
│  │ ├ feat/auth●  │  │ └─────────────────────────────────┘ │ │
│  │ └ feat/dash●  │  │                                     │ │
│  │               │  │  Chat turns (scrollable)            │ │
│  │ Signals       │  │  ┌─ User message ────────────────┐  │ │
│  │ ? "which      │  │  │ "Add auth to the app"         │  │ │
│  │   pattern?"   │  │  │ ▸ 5 steps                     │  │ │
│  │               │  │  │ [markdown response]            │  │ │
│  │               │  │  └────────────────────────────────┘  │ │
│  │               │  │                                     │ │
│  │               │  │  ┌─ Prompt (bg-base-2) ──────────┐  │ │
│  │               │  │  │ queued: "also fix types"    ✕ │  │ │
│  │               │  │  │ ┌─ Input (bg-base-3) ──────┐ │  │ │
│  │               │  │  │ │ Chat with main agent...   │ │  │ │
│  │               │  │  │ │ [Plan] claude-opus  [▲/■] │ │  │ │
│  │               │  │  │ └──────────────────────────┘ │  │ │
│  │               │  │  └──────────────────────────────┘  │ │
│  └───────────────┘  └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Agent Communication Flow

```
User ──→ Main Agent (project root)
           │
           ├──→ Worker Agent 1 (worktree: feature/auth)
           │     ├── signal("progress", "Reading auth patterns...")
           │     ├── signal("question", "Middleware or server routes?")
           │     │     ↑ user answers via UI → answer returned to agent
           │     ├── signal("done", "Auth implemented with...")
           │     └──→ Review Agent (same server, new session)
           │           ├── Reviews diff against conventions
           │           ├── Sends feedback to worker
           │           └── Approves → presented to user
           │
           └──→ Worker Agent 2 (worktree: feature/dashboard)
                 └── (same flow)
```

## Database Schema

7 tables: `projects`, `worktrees`, `sessions`, `signals`, `reviews`, `review_comments`, `dev_profile`

- **projects** - path, name, detected pkg manager/dev command, configOverride (stores opencodePort, sessionId)
- **worktrees** - branch, path, opencode port/pid, dev server state, linked linear issue
- **sessions** - opencode session id, role (main/worker/reviewer), status
- **signals** - type (question/done/progress/error/blocked), content, options, resolved state
- **reviews** - worktree, worker/reviewer sessions, iteration count, status, summary
- **review_comments** - file path, line number, author, content, resolved
- **dev_profile** - key/value pairs with categories (style/preference/convention/rule)

## What's Built

### Working
- Project management (open dirs, detect pkg manager, store in SQLite, dedup)
- Tabs (client-side state, close without deleting, project list on home)
- OpenCode integration (start serve per project, create/reconnect sessions, prompt_async, poll messages, abort)
- Chat UI (turn-based, collapsible tool steps, markdown response, message queue, build/plan mode, stop button, duration timer, copy response)
- Markdown rendering (marked + shiki with OKLCH theme)
- Tool call display (12+ tool types, heroicons, collapsible output, duration, status)
- Signal MCP server (JSON-RPC over stdio, dynamically registered with workers)
- Signal flow (create/resolve signals, long-poll for questions, sidebar notifications)
- Worktree management API (git worktree create/delete, port allocation, dev server toggle)
- Orchestrator service (delegateTask, triggerReview)
- Prompt builder (injects developer profile + skills into agent prompts)
- Review system API (reviews, comments, approve/commit)
- Settings page (developer profile CRUD)
- Session persistence (reconnects on restart)
- Design system (full OKLCH from zeitwerk - base layers, surfaces, text, edges, accent/danger/warn/success)
- Prompt input uses zeitwerk dialog stacking pattern (bg-base-2 outer → bg-base-3 inner)

### Partially Working / Needs Fixes
- Color contrast on prompt input (just switched to dialog pattern, needs verification)
- isWorking detection (improved, may have edge cases)
- OpenCode log noise (stderr logs show as ERROR prefix, cosmetic only)

## What's Not Built Yet

### Phase A: Chat UI Polish
1. Model selector dropdown (reka-ui Popover + fetch from providers API)
2. Session title (first line of user message or auto-generate)
3. Markdown CSS polish (code blocks, better spacing)
4. Fix remaining isWorking edge cases
5. Better empty states

### Phase B: Worktree Lifecycle (End-to-End)
6. Click worktree in sidebar → switch to that worktree's agent chat
7. New worktree creation → auto-start OpenCode → open chat
8. Worktree status indicators (poll session status per server)
9. Dev server toggle wired end-to-end

### Phase C: Task Delegation
10. Register main agent MCP tools (create_worktree, delegate_task, check_status, trigger_review)
11. Main agent creates worktrees and sends tasks to workers
12. Worker signals appear in main agent chat + sidebar
13. Auto review loop: worker done → reviewer → iterate → present to user

### Phase D: Review & Commit (Human in the Loop)
14. Live changes panel (right side split pane, file diffs from current session via GET /session/:id/diff)
15. Review page with @pierre/diffs, inline comments, file tree
16. Approve & commit flow (git add/commit/push, optionally create PR)
17. Request changes → feedback sent back to worker agent

### Phase E: Linear Integration
18. Fetch assigned issues from Linear API/MCP
19. Auto-create worktrees from issues (branch name from issue identifier)
20. Update issue status on completion
21. Link sessions to issues

### Phase F: Advanced Chat Features
22. Contenteditable input with @ mentions (files, agents) and / slash commands
23. File attachments (images, PDFs)
24. Prompt history (arrow up/down)
25. Shell mode (! prefix)
26. Message navigation rail (vertical dots)
27. Keyboard shortcuts (Cmd+B sidebar, Cmd+P search, etc.)

### Phase G: Infrastructure
28. Terminal panel (bottom, embedded terminal for dev server output)
29. Process cleanup on Tauri shutdown (kill all opencode/dev servers)
30. Error toasts/notification system
31. Replace polling with SSE from OpenCode servers
32. Better dev server port management

### Phase H: Future / Extensions
33. Slack integration
34. Container-based preview environments (for parallel dev servers without port conflicts)
35. Merge conflict detection (track files per agent, warn on overlaps)
36. Cost tracking (aggregate token usage across sessions)
37. Multi-device sync (Turso/libSQL)

## Key Design Decisions

- **One OpenCode server per project/worktree** - each gets its own `opencode serve` on a unique port
- **Session reconnection** - session ID stored in project's configOverride, reused on restart
- **Signal MCP** - local MCP server (stdio transport) registered dynamically with each OpenCode worker via POST /mcp
- **Message queue** - rapid-fire messages queued client-side, auto-dequeued when agent finishes current turn
- **One dev server at a time** - only one worktree can run on :3000 (OAuth redirect constraint)
- **Tabs are client-side only** - closing a tab doesn't delete the project from the database
- **Prompt input stacking** - uses zeitwerk dialog double-card pattern (bg-base-2 outer container, bg-base-3 inner input)
- **Design system** - OKLCH seed-based with directional surfaces. base-* for spatial layers, surface-* for interactive shifts
- **Components** - prefixed with o- (for orchestrator). Built on reka-ui primitives. Heroicons 16/solid for all icons.

## Running the App

```bash
# Development (browser)
bun run dev
# Open http://localhost:3200

# Development (Tauri desktop app)
bun run tauri:dev
# First run compiles Rust (~2-3 min), subsequent runs are fast

# Production build
bun run tauri:build
```

## Project Structure

```
hive/
├── app/
│   ├── assets/css/app.css        # OKLCH design system
│   ├── components/
│   │   ├── o-button.vue
│   │   ├── o-hover.vue
│   │   ├── o-chat/               # Chat UI (index, input, turn, tool-call, markdown, queue)
│   │   ├── o-dialog/
│   │   ├── o-header/
│   │   ├── o-input/
│   │   ├── o-review/             # Review UI (diff-viewer, file-tree, index)
│   │   ├── o-sidebar/            # Sidebar (worktrees, signals)
│   │   ├── o-status-dot/
│   │   └── o-tabs/
│   ├── layouts/default.vue       # Shell: titlebar + sidebar + content
│   └── pages/
│       ├── index.vue             # Project list / home
│       ├── project/[id].vue      # Main project chat
│       ├── review/[id].vue       # Review page
│       └── settings.vue          # Developer profile
├── server/
│   ├── api/
│   │   ├── projects/[id]/        # start, session, prompt, messages, abort, diff, status, providers
│   │   ├── worktrees/            # CRUD, delegate, dev-server, review
│   │   ├── sessions/             # CRUD, prompt, messages
│   │   ├── signals/              # list, resolve
│   │   ├── reviews/              # CRUD, approve, comments
│   │   ├── profile/              # CRUD
│   │   ├── mcp/signal.post.ts    # MCP signal endpoint (long-polls for questions)
│   │   └── events.get.ts         # SSE event stream
│   ├── database/                 # Drizzle schema + SQLite init
│   ├── mcp/signal-server.ts      # MCP server for worker agents (stdio transport)
│   ├── services/                 # orchestrator, process, worktree, port-allocator, detector, prompt-builder
│   └── utils/parse-config.ts
├── prompts/                      # Agent prompt templates (main, worker, reviewer)
├── skills/                       # Convention files injected into prompts (nuxt.md)
├── src-tauri/                    # Tauri v2 Rust backend
├── nuxt.config.ts
├── drizzle.config.ts
└── package.json
```
