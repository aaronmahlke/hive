import { db } from "../../database";
import { sessions, worktrees } from "../../database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    worktreeId: string;
    role?: "main" | "worker" | "reviewer";
  }>(event);

  if (!body.worktreeId) {
    throw createError({
      statusCode: 400,
      message: "worktreeId is required",
    });
  }

  const role = body.role || "worker";

  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, body.worktreeId),
  });

  if (!worktree || !worktree.opencodePort) {
    throw createError({
      statusCode: 400,
      message: "Worktree not found or OpenCode server not running",
    });
  }

  // Check for existing session on this worktree with the same role
  const existing = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.worktreeId, body.worktreeId),
      eq(sessions.role, role),
    ),
  });

  if (existing?.opencodeSessionId) {
    // Verify the OpenCode session still exists
    try {
      const res = await fetch(
        `http://localhost:${worktree.opencodePort}/session/${existing.opencodeSessionId}/message`,
      );
      if (res.ok) {
        return { sessionId: existing.id, opencodeSessionId: existing.opencodeSessionId, reconnected: true };
      }
    } catch {
      // Session gone, create a new one below
    }
  }

  // Create a session on the OpenCode server
  const opencodeUrl = `http://localhost:${worktree.opencodePort}`;
  let opencodeSessionId: string | undefined;

  try {
    const res = await fetch(`${opencodeUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    opencodeSessionId = data.id;
  } catch (e) {
    console.warn("Failed to create OpenCode session:", e);
  }

  if (existing) {
    // Update the existing session with the new OpenCode session ID
    await db
      .update(sessions)
      .set({ opencodeSessionId, status: "idle" })
      .where(eq(sessions.id, existing.id));
    return { sessionId: existing.id, opencodeSessionId, reconnected: false };
  }

  const id = nanoid();
  await db.insert(sessions).values({
    id,
    worktreeId: body.worktreeId,
    opencodeSessionId,
    role,
    status: "idle",
  });

  return { sessionId: id, opencodeSessionId, reconnected: false };
});
