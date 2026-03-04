import { db } from "../../database";
import { sessions, worktrees } from "../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const worktreeId = query.worktreeId as string | undefined;

  if (!worktreeId) {
    throw createError({ statusCode: 400, message: "worktreeId is required" });
  }

  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, worktreeId),
  });
  if (!worktree?.opencodePort) return [];

  const dbSessions = await db.select().from(sessions).where(eq(sessions.worktreeId, worktreeId));
  if (!dbSessions.length) return [];

  // Fetch titles from OpenCode for sessions we track
  type OcSession = { id: string; title: string; parentID?: string; time: { created: number; updated: number } };
  let ocSessions: OcSession[] = [];
  try {
    const res = await fetch(`http://localhost:${worktree.opencodePort}/session`);
    ocSessions = await res.json();
  } catch {
    return [];
  }

  const ocById = new Map(ocSessions.map((s) => [s.id, s]));

  return dbSessions
    .map((dbS) => {
      const oc = dbS.opencodeSessionId ? ocById.get(dbS.opencodeSessionId) : null;
      return {
        hiveSessionId: dbS.id,
        opencodeSessionId: dbS.opencodeSessionId,
        title: oc?.title || "Untitled",
        createdAt: oc?.time.created || 0,
        updatedAt: oc?.time.updated || 0,
      };
    })
    .filter((s) => s.opencodeSessionId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
});
