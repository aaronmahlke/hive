import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../utils/parse-config";

/**
 * Send a prompt to the project's main OpenCode session (async).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody<{ sessionId: string; message: string }>(event);

  if (!id || !body.sessionId || !body.message) {
    throw createError({
      statusCode: 400,
      message: "id, sessionId, and message are required",
    });
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
      message: "OpenCode server not running",
    });
  }

  try {
    await fetch(
      `http://localhost:${port}/session/${body.sessionId}/prompt_async`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: [{ type: "text", text: body.message }],
        }),
      },
    );
    return { success: true };
  } catch {
    throw createError({
      statusCode: 500,
      message: "Failed to send prompt to OpenCode",
    });
  }
});
