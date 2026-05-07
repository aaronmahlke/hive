import { db } from "../../database";
import { sessions, worktrees } from "../../database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const forceNew = query.new === "true";

  const body = await readBody<{
    worktreeId?: string;
    port?: number;
    role?: "main" | "worker" | "reviewer";
  }>(event);

  let opencodePort: number | null = null;
  let worktreeId: string | null = body.worktreeId || null;
  let worktreePath: string | null = null;

  if (worktreeId) {
    const worktree = await db.query.worktrees.findFirst({
      where: eq(worktrees.id, worktreeId),
    });
    if (!worktree?.opencodePort) {
      throw createError({ statusCode: 400, message: "Worktree not found or server not running" });
    }
    opencodePort = worktree.opencodePort;
    worktreePath = worktree.path;
  } else if (body.port) {
    opencodePort = body.port;
  }

  if (!opencodePort) {
    throw createError({ statusCode: 400, message: "worktreeId or port is required" });
  }

  const role = body.role || "worker";
  const dirParam = worktreePath ? `?directory=${encodeURIComponent(worktreePath)}` : "";

  if (!forceNew && worktreeId) {
    const existing = await db.query.sessions.findFirst({
      where: and(eq(sessions.worktreeId, worktreeId), eq(sessions.role, role)),
    });

    if (existing?.opencodeSessionId) {
      try {
        const res = await fetch(
          `http://localhost:${opencodePort}/session/${existing.opencodeSessionId}/message`,
        );
        if (res.ok) {
          return { sessionId: existing.id, opencodeSessionId: existing.opencodeSessionId, reused: true };
        }
      } catch {}

      let newOcId: string | undefined;
      try {
        const res = await fetch(`http://localhost:${opencodePort}/session${dirParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        newOcId = (await res.json()).id;
      } catch {}

      if (newOcId) {
        await db.update(sessions).set({ opencodeSessionId: newOcId, status: "idle" }).where(eq(sessions.id, existing.id));
        return { sessionId: existing.id, opencodeSessionId: newOcId, reused: false };
      }
    }
  }

  let opencodeSessionId: string | undefined;
  try {
    const res = await fetch(`http://localhost:${opencodePort}/session${dirParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    opencodeSessionId = (await res.json()).id;
  } catch {
    throw createError({ statusCode: 500, message: "Failed to create OpenCode session" });
  }

  const id = nanoid();
  await db.insert(sessions).values({ id, worktreeId, opencodeSessionId, role, status: "idle" });

  return { sessionId: id, opencodeSessionId };
});
