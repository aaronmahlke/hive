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
  const git = simpleGit(targetPath);

  try {
    // Get file status first — this always works
    const status = await git.status();

    let hasCommits = true;
    try {
      await git.log(["-1"]);
    } catch {
      hasCommits = false;
    }

    let combinedDiff = "";
    let stagedDiff = "";
    let unstagedDiff = "";

    if (hasCommits) {
      [combinedDiff, stagedDiff, unstagedDiff] = await Promise.all([
        git.diff(["HEAD"]),
        git.diff(["--cached"]),
        git.diff(),
      ]);
    } else {
      stagedDiff = await git.diff(["--cached"]);
      combinedDiff = stagedDiff;
    }

    const hasChange = (s: string) => s !== " " && s !== "" && s !== "?" && s !== "!";

    const files = status.files
      .filter((f) => hasChange(f.index) || hasChange(f.working_dir) || f.working_dir === "?")
      .map((f) => ({
        path: f.path,
        status: hasChange(f.index) ? f.index : f.working_dir || "?",
        staged: hasChange(f.index),
        modifiedAfterStaged: hasChange(f.index) && hasChange(f.working_dir),
      }));

    return {
      diff: combinedDiff || "",
      stagedDiff: stagedDiff || "",
      unstagedDiff: unstagedDiff || "",
      files,
      ahead: status.ahead,
      behind: status.behind,
      branch: status.current || null,
    };
  } catch (e: any) {
    console.error(`[changes] Error for project ${id}:`, e.message);
    return { diff: "", files: [] };
  }
});
