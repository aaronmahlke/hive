import { db } from "../../database";
import { worktrees, projects } from "../../database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createWorktree } from "../../services/worktree";
import { allocatePort } from "../../services/port-allocator";
import { installDeps, startOpenCodeServer } from "../../services/process";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    projectId: string;
    branchName: string;
    linearIssueId?: string;
    linearIssueIdentifier?: string;
  }>(event);

  if (!body.projectId || !body.branchName) {
    throw createError({
      statusCode: 400,
      message: "projectId and branchName are required",
    });
  }

  // Get the project
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, body.projectId),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  // Create git worktree
  const worktreePath = await createWorktree(project.path, body.branchName);

  // Allocate a port for the OpenCode server
  const port = await allocatePort();

  const id = nanoid();

  // Save to database
  const [worktree] = await db
    .insert(worktrees)
    .values({
      id,
      projectId: body.projectId,
      branchName: body.branchName,
      path: worktreePath,
      status: "active",
      opencodePort: port,
      linearIssueId: body.linearIssueId,
      linearIssueIdentifier: body.linearIssueIdentifier,
    })
    .returning();

  // Install dependencies in the background
  if (project.installCommand) {
    installDeps(worktreePath, project.installCommand).then((result) => {
      if (result.success) {
        console.log(`[worktree:${body.branchName}] Dependencies installed`);
      } else {
        console.error(
          `[worktree:${body.branchName}] Install failed:`,
          result.output,
        );
      }
    });
  }

  // Start OpenCode server
  const pid = startOpenCodeServer(worktreePath, port);

  // Update PID in database
  await db
    .update(worktrees)
    .set({ opencodePid: pid })
    .where(eq(worktrees.id, id));

  return { ...worktree, opencodePid: pid };
});
