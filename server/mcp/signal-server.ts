#!/usr/bin/env node

/**
 * Hive Signal MCP Server
 *
 * A local MCP server that worker agents use to communicate
 * back to the Hive orchestrator. Implements the signal tool for:
 * - question: Ask the user a question (blocks until answered)
 * - done: Signal task completion
 * - progress: Report progress
 * - error: Report an error
 * - blocked: Signal that something is blocking progress
 *
 * Communication with the Hive backend:
 * - Writes signals to the Hive API (HTTP POST to the Nuxt server)
 * - For questions, polls until the user answers via the Hive UI
 *
 * Usage (spawned as a local MCP):
 *   HIVE_API_URL=http://localhost:3100 HIVE_SESSION_ID=xxx node signal-server.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const HIVE_API_URL = process.env.HIVE_API_URL || "http://localhost:3100";
const HIVE_SESSION_ID = process.env.HIVE_SESSION_ID || "unknown";

const server = new Server(
  { name: "hive-signal", version: "0.1.0" },
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
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "signal") {
    return {
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }

  const args = request.params.arguments as {
    type: string;
    content: string;
    options?: string[];
  };

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
      // The API blocked and returned the user's answer
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
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
