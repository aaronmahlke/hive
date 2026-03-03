import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import simpleGit from "simple-git";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody<{ worktreePath?: string }>(event);

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const targetPath = body.worktreePath || project.path;
  const git = simpleGit(targetPath);

  try {
    await git.push();
    const status = await git.status();
    return { success: true, ahead: status.ahead, branch: status.current };
  } catch (e: any) {
    const msg = e.message || "";

    if (msg.includes("no upstream") || msg.includes("has no upstream")) {
      try {
        const status = await git.status();
        const branch = status.current;
        if (branch) {
          await git.push(["-u", "origin", branch]);
          const newStatus = await git.status();
          return { success: true, ahead: newStatus.ahead, branch };
        }
      } catch (retryErr: any) {
        throw createError({
          statusCode: 500,
          message: retryErr.message || "Push failed",
        });
      }
    }

    throw createError({
      statusCode: 500,
      message: msg,
    });
  }
});
