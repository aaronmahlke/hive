import { db } from "../../../database";
import { sessions, worktrees } from "../../../database/schema";
import { eq } from "drizzle-orm";

/**
 * Get messages for a session.
 * Proxies to OpenCode's GET /session/:id/message endpoint.
 *
 * OpenCode returns: { info: { role, id, sessionID, ... }, parts: [{ type, text }] }[]
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const session = await db.query.sessions.findFirst({
    where: { id },
  });

  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }

  const worktree = await db.query.worktrees.findFirst({
    where: { id: session.worktreeId! },
  });

  if (!worktree?.opencodePort || !session.opencodeSessionId) {
    return [];
  }

  const opencodeUrl = `http://localhost:${worktree.opencodePort}`;

  try {
    // OpenCode API: GET /session/:id/message (singular, not messages)
    const res = await fetch(
      `${opencodeUrl}/session/${session.opencodeSessionId}/message`,
    );
    const messages = await res.json();

    // messages is an array of { info: { role, ... }, parts: [{ type, text }] }
    return messages;
  } catch {
    return [];
  }
});
