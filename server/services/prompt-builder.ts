import { db } from "../database";
import { devProfile, worktrees } from "../database/schema";
import { eq } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Build a prompt for a worker agent by injecting:
 * - Developer profile preferences
 * - Skills (convention files)
 * - Task description
 * - Worktree status context
 */
export async function buildWorkerPrompt(opts: {
  taskDescription: string;
  linearIssueDescription?: string;
  worktreeId?: string;
}): Promise<string> {
  const template = loadTemplate("worker-agent.md");
  const profile = await loadDevProfile();
  const skills = loadSkills();

  let prompt = template
    .replace("{{task_description}}", opts.taskDescription)
    .replace(
      "{{linear_issue_description}}",
      opts.linearIssueDescription || "No linked issue.",
    )
    .replace("{{dev_profile}}", profile)
    .replace("{{skills}}", skills);

  return prompt;
}

/**
 * Build a prompt for the main orchestrator agent.
 */
export async function buildMainPrompt(): Promise<string> {
  const template = loadTemplate("main-agent.md");
  const profile = await loadDevProfile();

  // Get active worktrees
  const activeWorktrees = await db
    .select()
    .from(worktrees)
    .where(eq(worktrees.status, "active"));

  const worktreeStatus = activeWorktrees.length
    ? activeWorktrees
        .map(
          (wt) =>
            `- ${wt.branchName} (port: ${wt.opencodePort}, dev: ${wt.devServerActive ? "active" : "inactive"})`,
        )
        .join("\n")
    : "No active worktrees.";

  return template
    .replace("{{dev_profile}}", profile)
    .replace("{{worktree_status}}", worktreeStatus);
}

/**
 * Build a prompt for the review agent.
 */
export async function buildReviewerPrompt(diff: string): Promise<string> {
  const template = loadTemplate("reviewer-agent.md");
  const profile = await loadDevProfile();
  const skills = loadSkills();

  return template
    .replace("{{dev_profile}}", profile)
    .replace("{{skills}}", skills)
    .replace("{{diff}}", diff);
}

function loadTemplate(name: string): string {
  // Try multiple possible locations for prompts
  const paths = [
    join(process.cwd(), "prompts", name),
    join(process.cwd(), "..", "prompts", name),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      return readFileSync(p, "utf-8");
    }
  }

  return `# ${name}\n\nTemplate not found.`;
}

function loadSkills(): string {
  const skillsDir = join(process.cwd(), "skills");
  const skillFiles = ["nuxt.md", "vue.md", "general.md"];
  const skills: string[] = [];

  for (const file of skillFiles) {
    const path = join(skillsDir, file);
    if (existsSync(path)) {
      skills.push(readFileSync(path, "utf-8"));
    }
  }

  return skills.join("\n\n---\n\n") || "No skills configured.";
}

async function loadDevProfile(): Promise<string> {
  const entries = await db.select().from(devProfile);

  if (!entries.length) {
    return "No developer profile configured yet.";
  }

  const grouped: Record<string, string[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(`- ${entry.key}: ${entry.value}`);
  }

  return Object.entries(grouped)
    .map(([cat, items]) => `### ${cat}\n${items.join("\n")}`)
    .join("\n\n");
}
