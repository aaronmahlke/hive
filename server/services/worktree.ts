import simpleGit from "simple-git";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { spawn } from "child_process";

export type WorktreeInfo = {
  path: string;
  branch: string;
  isMain: boolean;
};

/**
 * Create a git worktree for a branch.
 * Worktrees are placed in a sibling `.hive-worktrees/` directory
 * next to the main repo, keeping things clean.
 */
export async function createWorktree(
  projectPath: string,
  branchName: string,
): Promise<string> {
  const git = simpleGit(projectPath);

  // Worktree directory: ../.hive-worktrees/<repo-name>/<branch-slug>
  const repoName = projectPath.split("/").pop() || "project";
  const branchSlug = branchName.replace(/\//g, "-");
  const worktreeBase = join(dirname(projectPath), ".hive-worktrees", repoName);
  const worktreePath = join(worktreeBase, branchSlug);

  if (existsSync(worktreePath)) {
    // Worktree already exists, just return the path
    return worktreePath;
  }

  // Check if branch exists remotely or locally
  const branches = await git.branch();

  if (branches.all.includes(branchName)) {
    // Branch exists, create worktree from it
    await git.raw(["worktree", "add", worktreePath, branchName]);
  } else if (
    branches.all.includes(`remotes/origin/${branchName}`)
  ) {
    // Remote branch exists, track it
    await git.raw([
      "worktree",
      "add",
      "--track",
      "-b",
      branchName,
      worktreePath,
      `origin/${branchName}`,
    ]);
  } else {
    // New branch, create from current HEAD
    await git.raw([
      "worktree",
      "add",
      "-b",
      branchName,
      worktreePath,
    ]);
  }

  return worktreePath;
}

/**
 * Remove a git worktree.
 */
export async function removeWorktree(
  projectPath: string,
  worktreePath: string,
): Promise<void> {
  const git = simpleGit(projectPath);
  await git.raw(["worktree", "remove", worktreePath, "--force"]);
}

/**
 * List all worktrees for a repo by reading the .git/worktrees/ directory.
 * This is faster than running `git worktree list` as a subprocess.
 * Returns the main worktree first, then linked worktrees.
 */
export function listWorktrees(projectPath: string): WorktreeInfo[] {
  const results: WorktreeInfo[] = [];

  // Get the main worktree's branch from HEAD
  const mainBranch = getHeadBranch(projectPath);
  results.push({
    path: projectPath,
    branch: mainBranch || "HEAD",
    isMain: true,
  });

  // Read linked worktrees from .git/worktrees/
  const worktreesDir = join(projectPath, ".git", "worktrees");
  if (!existsSync(worktreesDir)) {
    return results;
  }

  try {
    const entries = readdirSync(worktreesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const wtDir = join(worktreesDir, entry.name);

      // Read the gitdir file to get the worktree path
      const gitdirPath = join(wtDir, "gitdir");
      if (!existsSync(gitdirPath)) continue;

      const gitdir = readFileSync(gitdirPath, "utf-8").trim();
      // gitdir points to the .git file inside the worktree directory
      const wtPath = resolve(dirname(gitdir));

      // Read HEAD to get the branch
      const headPath = join(wtDir, "HEAD");
      let branch = entry.name;
      if (existsSync(headPath)) {
        const head = readFileSync(headPath, "utf-8").trim();
        if (head.startsWith("ref: refs/heads/")) {
          branch = head.replace("ref: refs/heads/", "");
        }
      }

      // Only include if the worktree directory actually exists
      if (existsSync(wtPath)) {
        results.push({ path: wtPath, branch, isMain: false });
      }
    }
  } catch (e) {
    console.warn("[worktree] Failed to read .git/worktrees:", e);
  }

  return results;
}

/**
 * Read the current branch from a repo's HEAD file.
 */
function getHeadBranch(projectPath: string): string | null {
  try {
    const headPath = join(projectPath, ".git", "HEAD");
    if (!existsSync(headPath)) return null;
    const head = readFileSync(headPath, "utf-8").trim();
    if (head.startsWith("ref: refs/heads/")) {
      return head.replace("ref: refs/heads/", "");
    }
    // Detached HEAD — return short hash
    return head.slice(0, 8);
  } catch {
    return null;
  }
}

/**
 * Install dependencies in a worktree directory.
 */
export function installDeps(
  worktreePath: string,
  installCommand: string,
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const [cmd, ...args] = installCommand.split(" ");
    let output = "";

    const child = spawn(cmd, args, {
      cwd: worktreePath,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data: Buffer) => { output += data.toString(); });
    child.stderr?.on("data", (data: Buffer) => { output += data.toString(); });
    child.on("exit", (code) => { resolve({ success: code === 0, output }); });
    child.on("error", (err) => { resolve({ success: false, output: err.message }); });
  });
}
