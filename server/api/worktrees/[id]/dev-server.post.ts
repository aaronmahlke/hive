import { db } from "../../../database";
import { worktrees, projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { startDevServer, stopDevServer } from "../../../services/process";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, id),
  });

  if (!worktree) {
    throw createError({ statusCode: 404, message: "Worktree not found" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, worktree.projectId),
  });

  if (!project?.devCommand) {
    throw createError({
      statusCode: 400,
      message: "No dev command configured for this project",
    });
  }

  // Stop any existing dev server
  stopDevServer();

  // Mark all worktrees as not having active dev server
  await db
    .update(worktrees)
    .set({ devServerActive: false })
    .where(eq(worktrees.projectId, worktree.projectId));

  // Start dev server for this worktree
  startDevServer(worktree.path, project.devCommand);

  // Mark this worktree as having active dev server
  await db
    .update(worktrees)
    .set({ devServerActive: true })
    .where(eq(worktrees.id, id));

  return { success: true, worktreeId: id };
});
