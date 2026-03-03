import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { stopProcess } from "../../../services/process";
import { parseConfig } from "../../../utils/parse-config";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const body = await readBody<{
    opencodeConfigPath?: string | null;
  }>(event);

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const updates: Record<string, any> = {};

  if ("opencodeConfigPath" in body) {
    updates.opencodeConfigPath = body.opencodeConfigPath || null;
  }

  if (Object.keys(updates).length === 0) {
    return project;
  }

  await db.update(projects).set(updates).where(eq(projects.id, id));

  // If config path changed, kill the running OpenCode server so it restarts with the new config
  if ("opencodeConfigPath" in body) {
    stopProcess(`opencode:${project.path}`);
    const config = parseConfig(project.configOverride);
    if (config.opencodePort) {
      await db.update(projects).set({
        configOverride: { ...config, opencodePort: null, opencodePid: null } as any,
      }).where(eq(projects.id, id));
    }
  }

  return db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
});
