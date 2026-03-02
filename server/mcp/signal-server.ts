#!/usr/bin/env node

/**
 * Hive Signal MCP Server
 *
 * A local MCP server that OpenCode agents use to communicate
 * back to the Hive orchestrator. Implements tools for:
 *
 * - signal: Ask questions, report progress/completion/errors
 * - delegate_task: Create a worktree and delegate a task to a worker agent
 *
 * Communication with the Hive backend:
 * - Writes signals to the Hive API (HTTP POST to the Nuxt server)
 * - For questions, polls until the user answers via the Hive UI
 * - For delegation, calls the orchestrator endpoint
 *
 * Usage (spawned by OpenCode as a local MCP):
 *   HIVE_API_URL=http://localhost:3200 HIVE_SESSION_ID=xxx HIVE_PROJECT_ID=yyy node signal-server.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const HIVE_API_URL = process.env.HIVE_API_URL || "http://localhost:3200";
const HIVE_SESSION_ID = process.env.HIVE_SESSION_ID || "unknown";
const HIVE_PROJECT_ID = process.env.HIVE_PROJECT_ID || "unknown";

const server = new Server(
  { name: "hive-signal", version: "0.2.0" },
  { capabilities: { tools: {} } },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "signal",
      description:
        "Send a signal to the Hive orchestrator. Use this to ask questions, " +
        "report progress, signal completion, or report errors. " +
        "For questions, this tool will block until the user provides an answer.",
      inputSchema: {
        type: "object" as const,
        properties: {
          type: {
            type: "string",
            enum: ["question", "done", "progress", "error", "blocked"],
            description:
              "Signal type. 'question' blocks until answered. Others return immediately.",
          },
          content: {
            type: "string",
            description: "The message content.",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional: multiple choice options for questions. If provided, the user picks one.",
          },
        },
        required: ["type", "content"],
      },
    },
    {
      name: "delegate_task",
      description:
        "Create a new git worktree and delegate a task to a worker agent. " +
        "The worker agent will run in an isolated worktree on a separate branch. " +
        "Use this to parallelize work — each task gets its own branch and agent. " +
        "The worker can signal back progress, ask questions, and report completion.",
      inputSchema: {
        type: "object" as const,
        properties: {
          branchName: {
            type: "string",
            description:
              "The git branch name for the worktree. Use a descriptive name like 'feature/add-auth' or 'fix/header-layout'.",
          },
          taskDescription: {
            type: "string",
            description:
              "A detailed description of the task for the worker agent. " +
              "Be specific about what needs to be done, which files to modify, and acceptance criteria.",
          },
          linearIssueId: {
            type: "string",
            description: "Optional: Linear issue ID to link to this worktree.",
          },
          linearIssueIdentifier: {
            type: "string",
            description: "Optional: Linear issue identifier (e.g., 'ENG-123').",
          },
          linearIssueDescription: {
            type: "string",
            description: "Optional: Linear issue description to include in the worker prompt.",
          },
        },
        required: ["branchName", "taskDescription"],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  if (toolName === "signal") {
    return handleSignal(request.params.arguments as any);
  }

  if (toolName === "delegate_task") {
    return handleDelegateTask(request.params.arguments as any);
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
    isError: true,
  };
});

async function handleSignal(args: {
  type: string;
  content: string;
  options?: string[];
}) {
  try {
    const response = await fetch(`${HIVE_API_URL}/api/mcp/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: args.type,
        content: args.content,
        options: args.options,
        sessionId: HIVE_SESSION_ID,
      }),
    });

    const data = await response.json();

    if (args.type === "question" || args.type === "blocked") {
      return {
        content: [
          {
            type: "text",
            text: (data as any).answer || "No answer provided.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Signal sent: ${args.type} - ${args.content}`,
        },
      ],
    };
  } catch (e: any) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to send signal: ${e.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function handleDelegateTask(args: {
  branchName: string;
  taskDescription: string;
  linearIssueId?: string;
  linearIssueIdentifier?: string;
  linearIssueDescription?: string;
}) {
  try {
    const response = await fetch(`${HIVE_API_URL}/api/mcp/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: HIVE_PROJECT_ID,
        branchName: args.branchName,
        taskDescription: args.taskDescription,
        linearIssueId: args.linearIssueId,
        linearIssueIdentifier: args.linearIssueIdentifier,
        linearIssueDescription: args.linearIssueDescription,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        content: [
          {
            type: "text",
            text: `Failed to delegate task: ${error}`,
          },
        ],
        isError: true,
      };
    }

    const data = (await response.json()) as {
      worktreeId: string;
      sessionId: string;
    };

    return {
      content: [
        {
          type: "text",
          text:
            `Task delegated successfully.\n` +
            `Branch: ${args.branchName}\n` +
            `Worktree ID: ${data.worktreeId}\n` +
            `Session ID: ${data.sessionId}\n\n` +
            `The worker agent is now running in an isolated worktree. ` +
            `It will signal back when it needs help or when it's done.`,
        },
      ],
    };
  } catch (e: any) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to delegate task: ${e.message}`,
        },
      ],
      isError: true,
    };
  }
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
