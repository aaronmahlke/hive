import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { join } from "path";
import simpleGit from "simple-git";

/**
 * Read a file's content from the project directory.
 * Query:
 *   ?path=relative/path/to/file  (required)
 *   ?worktreePath=/abs/path       (optional, scope to worktree)
 *   ?ref=HEAD                     (optional, read from git ref instead of working tree)
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const filePath = query.path as string;
  const worktreePath = query.worktreePath as string | undefined;
  const gitRef = query.ref as string | undefined;

  if (!id || !filePath) {
    throw createError({ statusCode: 400, message: "id and path are required" });
  }

  // Prevent path traversal
  if (filePath.includes("..")) {
    throw createError({ statusCode: 400, message: "Invalid path" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const basePath = worktreePath || project.path;

  // If a git ref is specified, read from that ref (e.g. HEAD for the old version)
  if (gitRef) {
    try {
      const git = simpleGit(basePath);
      // :0 refers to the staged version (git index)
      const refSpec = gitRef === ":0" ? `:0:${filePath}` : `${gitRef}:${filePath}`;
      const content = await git.show([refSpec]);
      return { content, path: filePath, ref: gitRef };
    } catch {
      return { content: "", path: filePath, ref: gitRef };
    }
  }

  try {
    const fullPath = join(basePath, filePath);
    const content = await readFile(fullPath, "utf-8");
    return { content, path: filePath };
  } catch {
    throw createError({ statusCode: 404, message: "File not found" });
  }
});
