import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../utils/parse-config";

/**
 * List all sessions for a project by querying the OpenCode server.
 * Filters by the project's directory and excludes sub-agent sessions (those with parentID).
 * Returns sessions sorted by most recently updated.
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
    return [];
  }

  try {
    const res = await fetch(`http://localhost:${port}/session`);
    if (!res.ok) return [];

    const allSessions = await res.json();

    // Filter to this project's directory, exclude sub-agent sessions
    const filtered = allSessions
      .filter((s: any) => s.directory === project.path && !s.parentID)
      .sort((a: any, b: any) => (b.time?.updated || 0) - (a.time?.updated || 0))
      .map((s: any) => ({
        id: s.id,
        title: s.title || s.slug || "Untitled",
        slug: s.slug,
        agent: s.agent,
        model: s.model,
        summary: s.summary,
        createdAt: s.time?.created,
        updatedAt: s.time?.updated,
      }));

    return filtered;
  } catch {
    return [];
  }
});
