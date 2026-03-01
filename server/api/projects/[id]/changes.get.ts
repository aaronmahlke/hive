import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import simpleGit from "simple-git";

/**
 * Get the current git diff and changed files for a project.
 * Returns the raw unified diff string and a list of changed file paths with status.
 *
 * Handles multiple scenarios:
 * - Normal repo with commits: diff against HEAD
 * - Repo with no commits: show all tracked (staged) files
 * - Unstaged modifications: git diff
 * - Staged changes: git diff --cached
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const project = await db.query.projects.findFirst({
    where: { id },
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const git = simpleGit(project.path);

  try {
    // Get file status first — this always works
    const status = await git.status();
    const files = [
      ...status.modified.map((path) => ({ path, status: "M" as const })),
      ...status.created.map((path) => ({ path, status: "A" as const })),
      ...status.deleted.map((path) => ({ path, status: "D" as const })),
      ...status.renamed.map((r) => ({ path: r.to, status: "R" as const })),
      ...status.not_added.map((path) => ({ path, status: "?" as const })),
    ];

    // Try to get a diff
    let diff = "";

    // Check if repo has any commits
    let hasCommits = true;
    try {
      await git.log(["-1"]);
    } catch {
      hasCommits = false;
    }

    if (hasCommits) {
      // Normal case: diff against HEAD (shows both staged + unstaged vs last commit)
      diff = await git.diff(["HEAD"]);

      if (!diff) {
        // Maybe only staged changes
        diff = await git.diff(["--cached"]);
      }
      if (!diff) {
        // Maybe only unstaged changes
        diff = await git.diff();
      }
    } else {
      // No commits yet — diff staged files against empty tree
      diff = await git.diff(["--cached"]);
    }

    console.log(
      `[changes] project=${id} hasCommits=${hasCommits} files=${files.length} diffBytes=${diff.length}`,
    );

    return { diff: diff || "", files };
  } catch (e: any) {
    console.error(`[changes] Error for project ${id}:`, e.message);
    return { diff: "", files: [] };
  }
});
