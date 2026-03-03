import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import simpleGit from "simple-git";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody<{
    path: string;
    unstage?: boolean;
    worktreePath?: string;
  }>(event);

  if (!id || !body.path) {
    throw createError({ statusCode: 400, message: "id and path are required" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const targetPath = body.worktreePath || project.path;
  const git = simpleGit(targetPath);

  if (body.unstage) {
    await git.reset(["HEAD", "--", body.path]);
  } else {
    await git.add(body.path);
  }

  return { success: true, path: body.path, staged: !body.unstage };
});
