import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Read a file's content from the project directory.
 * Query: ?path=relative/path/to/file
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const filePath = query.path as string;

  if (!id || !filePath) {
    throw createError({ statusCode: 400, message: "id and path are required" });
  }

  // Prevent path traversal
  if (filePath.includes("..")) {
    throw createError({ statusCode: 400, message: "Invalid path" });
  }

  const project = await db.query.projects.findFirst({
    where: { id },
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  try {
    const fullPath = join(project.path, filePath);
    const content = await readFile(fullPath, "utf-8");
    return { content, path: filePath };
  } catch {
    throw createError({ statusCode: 404, message: "File not found" });
  }
});
