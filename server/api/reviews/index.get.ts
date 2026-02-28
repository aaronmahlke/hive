import { db } from "../../database";
import { reviews } from "../../database/schema";
import { eq, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const worktreeId = query.worktreeId as string;

  if (worktreeId) {
    return db
      .select()
      .from(reviews)
      .where(eq(reviews.worktreeId, worktreeId))
      .orderBy(desc(reviews.createdAt));
  }

  return db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(20);
});
