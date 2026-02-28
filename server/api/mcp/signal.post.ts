import { db } from "../../database";
import { signals, sessions } from "../../database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * MCP Signal endpoint.
 * Worker agents call this to signal questions, progress, completion, etc.
 *
 * For "question" type signals, this endpoint blocks (long-polls)
 * until the user provides an answer via the UI.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    type: "question" | "done" | "progress" | "error" | "blocked";
    content: string;
    options?: string[];
    sessionId?: string;
  }>(event);

  if (!body.type || !body.content) {
    throw createError({
      statusCode: 400,
      message: "type and content are required",
    });
  }

  const signalId = nanoid();

  // Create the signal record
  const [signal] = await db
    .insert(signals)
    .values({
      id: signalId,
      sessionId: body.sessionId || "unknown",
      type: body.type,
      content: body.content,
      options: body.options ? body.options : null,
      resolved: false,
    })
    .returning();

  // Update session status based on signal type
  if (body.sessionId) {
    const statusMap: Record<string, string> = {
      question: "question",
      done: "done",
      progress: "working",
      error: "error",
      blocked: "question",
    };
    await db
      .update(sessions)
      .set({ status: statusMap[body.type] || "working" })
      .where(eq(sessions.id, body.sessionId));
  }

  // For questions, long-poll until resolved
  if (body.type === "question" || body.type === "blocked") {
    const answer = await waitForResolution(signalId, 300_000); // 5 min timeout
    return { answer };
  }

  // For non-blocking signals, return immediately
  return { success: true, signalId };
});

/**
 * Poll the database until the signal is resolved or timeout.
 */
async function waitForResolution(
  signalId: string,
  timeoutMs: number,
): Promise<string> {
  const start = Date.now();
  const pollInterval = 1000; // 1 second

  while (Date.now() - start < timeoutMs) {
    const signal = await db.query.signals.findFirst({
      where: and(eq(signals.id, signalId), eq(signals.resolved, true)),
    });

    if (signal?.resolvedContent) {
      return signal.resolvedContent;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return "No answer provided (timeout).";
}
