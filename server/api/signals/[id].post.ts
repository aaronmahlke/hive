import { db } from "../../database";
import { signals, sessions } from "../../database/schema";
import { eq } from "drizzle-orm";

/**
 * Resolve a signal (answer a question).
 * Called from the UI when the user answers a worker's question.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody<{ answer: string }>(event);

  if (!id || !body.answer) {
    throw createError({
      statusCode: 400,
      message: "id and answer are required",
    });
  }

  const signal = await db.query.signals.findFirst({
    where: eq(signals.id, id),
  });

  if (!signal) {
    throw createError({ statusCode: 404, message: "Signal not found" });
  }

  // Resolve the signal
  await db
    .update(signals)
    .set({
      resolved: true,
      resolvedContent: body.answer,
    })
    .where(eq(signals.id, id));

  // Update session status back to working
  if (signal.sessionId) {
    await db
      .update(sessions)
      .set({ status: "working" })
      .where(eq(sessions.id, signal.sessionId));
  }

  return { success: true };
});
