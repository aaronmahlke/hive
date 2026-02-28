import { db } from "../database";
import {
  sessions,
  worktrees,
  reviews,
  signals,
  projects,
} from "../database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { buildWorkerPrompt, buildReviewerPrompt } from "./prompt-builder";
import { allocatePort } from "./port-allocator";
import { createWorktree } from "./worktree";
import {
  startOpenCodeServer,
  installDeps,
} from "./process";

/**
 * Full lifecycle: create a worktree, start an agent, delegate a task.
 */
export async function delegateTask(opts: {
  projectId: string;
  branchName: string;
  taskDescription: string;
  linearIssueId?: string;
  linearIssueIdentifier?: string;
  linearIssueDescription?: string;
}): Promise<{
  worktreeId: string;
  sessionId: string;
}> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, opts.projectId),
  });

  if (!project) throw new Error("Project not found");

  // 1. Create worktree
  const worktreePath = await createWorktree(project.path, opts.branchName);
  const port = await allocatePort();
  const worktreeId = nanoid();

  await db.insert(worktrees).values({
    id: worktreeId,
    projectId: opts.projectId,
    branchName: opts.branchName,
    path: worktreePath,
    status: "active",
    opencodePort: port,
    linearIssueId: opts.linearIssueId,
    linearIssueIdentifier: opts.linearIssueIdentifier,
  });

  // 2. Install deps (background)
  if (project.installCommand) {
    installDeps(worktreePath, project.installCommand).then((result) => {
      if (!result.success) {
        console.error(`[orchestrator] Install failed for ${opts.branchName}`);
      }
    });
  }

  // 3. Create session ID first so we can pass it to the MCP
  const sessionId = nanoid();

  // 4. Start OpenCode server (registers signal MCP with sessionId)
  const pid = startOpenCodeServer(worktreePath, port, sessionId);
  await db
    .update(worktrees)
    .set({ opencodePid: pid })
    .where(eq(worktrees.id, worktreeId));

  // 5. Wait for server to be ready (registerSignalMcp already polls health)
  await new Promise((r) => setTimeout(r, 5000));
  let opencodeSessionId: string | undefined;

  try {
    const res = await fetch(`http://localhost:${port}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    opencodeSessionId = data.id;
  } catch (e) {
    console.warn("[orchestrator] Failed to create OpenCode session:", e);
  }

  await db.insert(sessions).values({
    id: sessionId,
    worktreeId,
    opencodeSessionId,
    role: "worker",
    status: "working",
  });

  // 6. Build and send the worker prompt
  const prompt = await buildWorkerPrompt({
    taskDescription: opts.taskDescription,
    linearIssueDescription: opts.linearIssueDescription,
    worktreeId,
  });

  if (opencodeSessionId) {
    try {
      await fetch(
        `http://localhost:${port}/session/${opencodeSessionId}/prompt_async`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parts: [{ type: "text", text: prompt }],
          }),
        },
      );
    } catch (e) {
      console.error("[orchestrator] Failed to send prompt:", e);
    }
  }

  return { worktreeId, sessionId };
}

/**
 * Trigger the review loop for a worktree.
 * Creates a review, spawns a reviewer session, sends the diff.
 */
export async function triggerReview(worktreeId: string): Promise<string> {
  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, worktreeId),
  });

  if (!worktree || !worktree.opencodePort) {
    throw new Error("Worktree or OpenCode server not available");
  }

  // Get the diff from the worktree
  const { default: simpleGit } = await import("simple-git");
  const git = simpleGit(worktree.path);
  let diff = "";

  try {
    diff = await git.diff(["HEAD"]);
    if (!diff) {
      diff = await git.diff(["--cached"]);
    }
  } catch {
    // no diff available
  }

  if (!diff) {
    throw new Error("No changes to review");
  }

  // Create review record
  const reviewId = nanoid();
  await db.insert(reviews).values({
    id: reviewId,
    worktreeId,
    status: "agent_review",
    iteration: 1,
  });

  // Create a reviewer session on the same OpenCode server
  const port = worktree.opencodePort;
  let reviewerOcSessionId: string | undefined;

  try {
    const res = await fetch(`http://localhost:${port}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    reviewerOcSessionId = data.id;
  } catch (e) {
    console.warn("[orchestrator] Failed to create reviewer session:", e);
  }

  const reviewerSessionId = nanoid();
  await db.insert(sessions).values({
    id: reviewerSessionId,
    worktreeId,
    opencodeSessionId: reviewerOcSessionId,
    role: "reviewer",
    status: "working",
  });

  // Update review with session IDs
  await db
    .update(reviews)
    .set({ reviewerSessionId })
    .where(eq(reviews.id, reviewId));

  // Build and send the review prompt
  const reviewPrompt = await buildReviewerPrompt(diff);

  if (reviewerOcSessionId) {
    try {
      await fetch(
        `http://localhost:${port}/session/${reviewerOcSessionId}/prompt_async`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parts: [{ type: "text", text: reviewPrompt }],
          }),
        },
      );
    } catch (e) {
      console.error("[orchestrator] Failed to send review prompt:", e);
    }
  }

  return reviewId;
}
