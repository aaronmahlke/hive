import { db } from "../../database";
import { worktrees, projects } from "../../database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { allocatePort } from "../../services/port-allocator";
import { startOpenCodeServer, isServerHealthy, installDeps } from "../../services/process";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    projectId: string;
    worktreePath: string;
    branchName: string;
  }>(event);

  if (!body.projectId || !body.worktreePath || !body.branchName) {
    throw createError({
      statusCode: 400,
      message: "projectId, worktreePath, and branchName are required",
    });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, body.projectId),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  let worktree = await db.query.worktrees.findFirst({
    where: and(
      eq(worktrees.projectId, body.projectId),
      eq(worktrees.path, body.worktreePath),
    ),
  });

  if (!worktree) {
    const id = nanoid();
    const port = await allocatePort();

    const [created] = await db
      .insert(worktrees)
      .values({
        id,
        projectId: body.projectId,
        branchName: body.branchName,
        path: body.worktreePath,
        status: "active",
        opencodePort: port,
      })
      .returning();

    worktree = created;

    if (project.installCommand) {
      installDeps(body.worktreePath, project.installCommand).then((result) => {
        if (!result.success) {
          console.error(`[worktree:start] Install failed for ${body.branchName}`);
        }
      });
    }

    const pid = startOpenCodeServer(body.worktreePath, port, undefined, body.projectId, project.opencodeConfigPath || undefined);
    await db
      .update(worktrees)
      .set({ opencodePid: pid })
      .where(eq(worktrees.id, id));

    const maxWait = 10_000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      if (await isServerHealthy(port)) {
        return { id, port, alreadyRunning: false };
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    return { id, port, alreadyRunning: false };
  }

  if (worktree.opencodePort && await isServerHealthy(worktree.opencodePort)) {
    return { id: worktree.id, port: worktree.opencodePort, alreadyRunning: true };
  }

  const port = await allocatePort();
  const pid = startOpenCodeServer(body.worktreePath, port, undefined, body.projectId, project.opencodeConfigPath || undefined);

  await db
    .update(worktrees)
    .set({ opencodePort: port, opencodePid: pid })
    .where(eq(worktrees.id, worktree.id));

  const maxWait = 10_000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (await isServerHealthy(port)) {
      return { id: worktree.id, port, alreadyRunning: false };
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return { id: worktree.id, port, alreadyRunning: false };
});
