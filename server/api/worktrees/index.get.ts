import { db } from "../../database";
import { worktrees, sessions, signals } from "../../database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { projects } from "../../database/schema";
import { listWorktrees } from "../../services/worktree";

export type WorktreeEntry = {
  id: string | null;
  projectId: string;
  branchName: string;
  path: string;
  isMain: boolean;
  status: "active" | "archived";
  opencodePort: number | null;
  agentStatus: "idle" | "working" | "question" | "done" | "error";
  pendingSignals: number;
  devServerActive: boolean;
  linearIssueId: string | null;
  linearIssueIdentifier: string | null;
};

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const projectId = query.projectId as string;

  if (!projectId) {
    throw createError({ statusCode: 400, message: "projectId is required" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  // Get worktrees from git (source of truth)
  const gitWorktrees = listWorktrees(project.path);

  // Get DB records for enrichment
  const dbWorktrees = await db
    .select()
    .from(worktrees)
    .where(eq(worktrees.projectId, projectId));

  const dbByPath = new Map(dbWorktrees.map((w) => [w.path, w]));

  // Get all session statuses for this project's worktrees
  const worktreeIds = dbWorktrees.map((w) => w.id);
  const allSessions =
    worktreeIds.length > 0
      ? await db
          .select()
          .from(sessions)
          .where(inArray(sessions.worktreeId, worktreeIds))
      : [];

  // Get pending question signals per session (only questions need user action)
  const sessionIds = allSessions.map((s) => s.id);
  const allSignals =
    sessionIds.length > 0
      ? await db
          .select()
          .from(signals)
          .where(
            and(
              inArray(signals.sessionId, sessionIds),
              eq(signals.resolved, false),
              eq(signals.type, "question"),
            ),
          )
      : [];

  // Build lookup maps
  const sessionsByWorktree = new Map<string, typeof allSessions>();
  for (const s of allSessions) {
    if (!s.worktreeId) continue;
    const list = sessionsByWorktree.get(s.worktreeId) || [];
    list.push(s);
    sessionsByWorktree.set(s.worktreeId, list);
  }

  const signalsBySession = new Map<string, number>();
  for (const sig of allSignals) {
    signalsBySession.set(sig.sessionId, (signalsBySession.get(sig.sessionId) || 0) + 1);
  }

  // Merge git worktrees with DB data
  const result: WorktreeEntry[] = gitWorktrees.map((gw) => {
    const dbRecord = dbByPath.get(gw.path);
    const wtSessions = dbRecord ? sessionsByWorktree.get(dbRecord.id) || [] : [];

    // Determine agent status from the most recent session
    let agentStatus: WorktreeEntry["agentStatus"] = "idle";
    if (wtSessions.length > 0) {
      // Pick the most active session (working > question > done > error > idle)
      const priority = { working: 4, question: 3, error: 2, done: 1, idle: 0 };
      wtSessions.sort(
        (a, b) => (priority[b.status as keyof typeof priority] ?? 0) - (priority[a.status as keyof typeof priority] ?? 0),
      );
      agentStatus = wtSessions[0]!.status as WorktreeEntry["agentStatus"];
    }

    // Count pending signals across all sessions in this worktree
    const pendingSignals = wtSessions.reduce(
      (sum, s) => sum + (signalsBySession.get(s.id) || 0),
      0,
    );

    return {
      id: dbRecord?.id ?? null,
      projectId,
      branchName: gw.branch,
      path: gw.path,
      isMain: gw.isMain,
      status: dbRecord?.status ?? "active",
      opencodePort: dbRecord?.opencodePort ?? null,
      agentStatus,
      pendingSignals,
      devServerActive: dbRecord?.devServerActive ?? false,
      linearIssueId: dbRecord?.linearIssueId ?? null,
      linearIssueIdentifier: dbRecord?.linearIssueIdentifier ?? null,
    } satisfies WorktreeEntry;
  });

  return result;
});
