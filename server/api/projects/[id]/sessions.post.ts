import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../utils/parse-config";

/**
 * Create a new session on the project's OpenCode server.
 * Returns the new session's ID.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
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
    throw createError({
      statusCode: 400,
      message: "OpenCode server not running. Call /start first.",
    });
  }

  try {
    const dirParam = `?directory=${encodeURIComponent(project.path)}`;
    const res = await fetch(`http://localhost:${port}/session${dirParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      throw new Error(`OpenCode returned ${res.status}`);
    }

    const session = await res.json();

    // Update the stored session ID for reconnection
    await db
      .update(projects)
      .set({
        configOverride: {
          ...config,
          sessionId: session.id,
        } as any,
      })
      .where(eq(projects.id, id));

    return { sessionId: session.id };
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      message: e.message || "Failed to create session",
    });
  }
});
