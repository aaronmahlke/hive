import { db } from "../database";
import { signals, sessions, worktrees } from "../database/schema";
import { eq, desc } from "drizzle-orm";

/**
 * SSE endpoint for real-time updates.
 * The frontend subscribes to this for live status changes.
 */
export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(eventType: string, data: any) {
        const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // Send initial state
      const allWorktrees = await db.select().from(worktrees);
      const allSessions = await db.select().from(sessions);
      const pendingSignals = await db
        .select()
        .from(signals)
        .where(eq(signals.resolved, false))
        .orderBy(desc(signals.createdAt));

      send("init", {
        worktrees: allWorktrees,
        sessions: allSessions,
        signals: pendingSignals,
      });

      // Poll for changes every 2 seconds
      const interval = setInterval(async () => {
        try {
          const currentWorktrees = await db.select().from(worktrees);
          const currentSessions = await db.select().from(sessions);
          const currentSignals = await db
            .select()
            .from(signals)
            .where(eq(signals.resolved, false))
            .orderBy(desc(signals.createdAt));

          send("update", {
            worktrees: currentWorktrees,
            sessions: currentSessions,
            signals: currentSignals,
          });
        } catch {
          // db might be closed
        }
      }, 2000);

      // Cleanup on close
      event.node.req.on("close", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream);
});
