import { defineEventHandler, readBody } from "h3";
import { convertToModelMessages } from "ai";
import { db } from "../database";
import { projects } from "../database/schema";
import { buildMainPrompt } from "../services/prompt-builder";
import { runAgent } from "../services/agent";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const { messages, projectId, model } = body as {
    messages: any[];
    projectId: string;
    model?: "opus" | "sonnet";
  };

  if (!messages || !projectId) {
    throw createError({
      statusCode: 400,
      message: "messages and projectId are required",
    });
  }

  // Look up the project to get its path
  const project = await db.query.projects.findFirst({
    where: { id: projectId },
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  // Build the system prompt
  const systemPrompt = await buildMainPrompt(projectId);

  // Convert UIMessages from the client to ModelMessages for streamText
  const modelMessages = await convertToModelMessages(messages);

  // Debug: log what tools look like
  console.log("[chat] messages count:", modelMessages.length);
  console.log("[chat] model:", model || "sonnet");

  // Run the agent with streaming
  const result = runAgent({
    messages: modelMessages,
    projectPath: project.path,
    modelPreference: model || "sonnet",
    systemPrompt,
  });

  // Return the streaming response compatible with Chat class
  return result.toUIMessageStreamResponse();
});
