import { db } from "../../database";
import { signals } from "../../database/schema";
import { eq, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const pending = query.pending === "true";

  if (pending) {
    return db
      .select()
      .from(signals)
      .where(eq(signals.resolved, false))
      .orderBy(desc(signals.createdAt));
  }

  return db.select().from(signals).orderBy(desc(signals.createdAt)).limit(50);
});
