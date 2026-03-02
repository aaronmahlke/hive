import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { startScript, stopScript } from "../../../services/process";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody<{
    script?: string;
    worktreePath?: string;
    stop?: boolean;
  }>(event);

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  if (body.stop) {
    stopScript();
    return { success: true, stopped: true };
  }

  if (!body.script) {
    throw createError({ statusCode: 400, message: "script name is required" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const targetPath = body.worktreePath || project.path;
  const pkgManager = project.pkgManager || "npm";

  const pid = startScript(targetPath, body.script, pkgManager);

  return { success: true, pid, script: body.script };
});
