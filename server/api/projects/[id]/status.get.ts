import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../utils/parse-config";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return { status: "unknown" };
  }

  const config = parseConfig(project.configOverride);
  const port = config.opencodePort;

  if (!port) {
    return { status: "no_server" };
  }

  try {
    const res = await fetch(`http://localhost:${port}/session/status`);
    const data = await res.json();

    // data is { [sessionID]: status }
    // Find the status for the stored session
    if (config.sessionId && data[config.sessionId]) {
      return { status: data[config.sessionId], sessionId: config.sessionId };
    }

    return { status: "idle", allStatuses: data };
  } catch {
    return { status: "disconnected" };
  }
});
