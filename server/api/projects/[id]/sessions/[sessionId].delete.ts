import { db } from "../../../../database";
import { projects } from "../../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../../utils/parse-config";

/**
 * Delete a session on the project's OpenCode server.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const sessionId = getRouterParam(event, "sessionId");

  if (!id || !sessionId) {
    throw createError({ statusCode: 400, message: "id and sessionId are required" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const config = parseConfig(project.configOverride);
  const port = config.opencodePort;

  if (!port) {
    throw createError({ statusCode: 400, message: "OpenCode server not running" });
  }

  try {
    const res = await fetch(`http://localhost:${port}/session/${sessionId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error(`OpenCode returned ${res.status}`);
    }

    return { deleted: true };
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      message: e.message || "Failed to delete session",
    });
  }
});
