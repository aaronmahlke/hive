import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getActiveScript } from "../../../services/process";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const worktreePath = query.worktreePath as string | undefined;

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const targetPath = worktreePath || project.path;
  const pkgPath = join(targetPath, "package.json");

  let scripts: Record<string, string> = {};
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      scripts = pkg.scripts || {};
    } catch {}
  }

  const active = getActiveScript();

  return {
    scripts,
    pkgManager: project.pkgManager || "npm",
    active: active ? active.script : null,
    activeCwd: active ? active.cwd : null,
  };
});
