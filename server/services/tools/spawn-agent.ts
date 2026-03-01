import { tool, jsonSchema } from "ai";
import { createWorktree } from "../worktree";

/**
 * Create a tool for spawning sub-agents.
 * Sub-agents can optionally work in isolated git worktrees.
 */
export function createSpawnAgentTool(
  projectPath: string,
  modelPreference: "opus" | "sonnet",
) {
  return tool({
    description:
      "Spawn a sub-agent to work on a task. " +
      "Use 'isolated: true' with a branch name to create a git worktree " +
      "so the sub-agent works on a separate branch without affecting the main tree. " +
      "The sub-agent has access to the same tools (bash, text editor, web search, etc).",
    inputSchema: jsonSchema<{
      task: string;
      isolated?: boolean;
      branchName?: string;
    }>({
      type: "object",
      properties: {
        task: {
          type: "string",
          description:
            "Detailed description of the task for the sub-agent to complete.",
        },
        isolated: {
          type: "boolean",
          description:
            "If true, create a git worktree for isolated work. Default: false.",
        },
        branchName: {
          type: "string",
          description:
            "Branch name for the worktree. Required if isolated is true.",
        },
      },
      required: ["task"],
    }),
    execute: async ({ task, isolated, branchName }) => {
      // Lazy import to avoid circular dependency
      const { runAgent, getModel } = await import("../agent");

      let agentCwd = projectPath;

      if (isolated) {
        if (!branchName) {
          return "Error: branchName is required when isolated is true.";
        }

        try {
          agentCwd = await createWorktree(projectPath, branchName);
        } catch (e: any) {
          return `Error creating worktree: ${e.message}`;
        }
      }

      const systemPrompt = [
        "You are a sub-agent working on a specific task.",
        "Complete the task thoroughly and report your results.",
        `Working directory: ${agentCwd}`,
        "",
        "## Task",
        task,
      ].join("\n");

      try {
        const result = await runAgent({
          messages: [{ role: "user", content: task }],
          projectPath: agentCwd,
          modelPreference,
          systemPrompt,
        });

        // Collect the full text response
        let fullText = "";
        for await (const part of result.textStream) {
          fullText += part;
        }

        return fullText || "(sub-agent produced no text output)";
      } catch (e: any) {
        return `Sub-agent error: ${e.message}`;
      }
    },
  });
}
