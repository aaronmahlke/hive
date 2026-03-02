import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

type FileTreeNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
};

const IGNORE_PATTERNS = new Set([
  "node_modules",
  ".git",
  ".nuxt",
  ".output",
  ".next",
  "dist",
  ".turbo",
  ".cache",
  ".hive-worktrees",
  "__pycache__",
  ".DS_Store",
  "bun.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

function buildTree(dirPath: string, basePath: string, depth = 0, maxDepth = 4): FileTreeNode[] {
  if (depth >= maxDepth) return [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      if (IGNORE_PATTERNS.has(entry.name) || entry.name.startsWith(".")) continue;

      const fullPath = join(dirPath, entry.name);
      const relPath = relative(basePath, fullPath);

      if (entry.isDirectory()) {
        const children = buildTree(fullPath, basePath, depth + 1, maxDepth);
        nodes.push({
          name: entry.name,
          path: relPath,
          type: "directory",
          children,
        });
      } else {
        nodes.push({
          name: entry.name,
          path: relPath,
          type: "file",
        });
      }
    }

    // Sort: directories first, then alphabetical
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return nodes;
  } catch {
    return [];
  }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const worktreePath = query.worktreePath as string | undefined;

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  // Use worktree path if provided, otherwise project root
  const targetPath = worktreePath || project.path;

  return buildTree(targetPath, targetPath);
});
