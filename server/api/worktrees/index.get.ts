import { db } from "../../database";
import { worktrees } from "../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const projectId = query.projectId as string;

  if (!projectId) {
    throw createError({ statusCode: 400, message: "projectId is required" });
  }

  return db
    .select()
    .from(worktrees)
    .where(eq(worktrees.projectId, projectId));
});
