import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../utils/parse-config";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const sessionId = query.sessionId as string;

  if (!id || !sessionId) {
    throw createError({
      statusCode: 400,
      message: "id and sessionId are required",
    });
  }

  const project = await db.query.projects.findFirst({
    where: { id },
  });

  if (!project) {
    return [];
  }

  const config = parseConfig(project.configOverride);
  const port = config.opencodePort;

  if (!port) {
    return [];
  }

  try {
    const res = await fetch(
      `http://localhost:${port}/session/${sessionId}/diff`,
    );
    return await res.json();
  } catch {
    return [];
  }
});
