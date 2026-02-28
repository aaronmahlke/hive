import { db } from "../../database";
import { projects } from "../../database/schema";
import { detectProject } from "../../services/detector";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string }>(event);

  if (!body.path) {
    throw createError({ statusCode: 400, message: "path is required" });
  }

  // Check if project with this path already exists
  const existing = await db.query.projects.findFirst({
    where: eq(projects.path, body.path),
  });

  if (existing) {
    // Return existing project instead of creating duplicate
    return existing;
  }

  const info = detectProject(body.path);
  const id = nanoid();

  const [project] = await db
    .insert(projects)
    .values({
      id,
      name: info.name,
      path: body.path,
      pkgManager: info.pkgManager,
      devCommand: info.devCommand,
      installCommand: info.installCommand,
    })
    .returning();

  return project;
});
