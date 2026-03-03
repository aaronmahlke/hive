import { db } from "../../../../database";
import { changeComments } from "../../../../database/schema";
import { eq, and, isNull } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const query = getQuery(event);
  const resolvedFilter = query.resolved;
  const worktreePath = query.worktreePath as string | undefined;

  const conditions = [eq(changeComments.projectId, id)];

  if (worktreePath) {
    conditions.push(eq(changeComments.worktreePath, worktreePath));
  } else {
    conditions.push(isNull(changeComments.worktreePath));
  }

  if (resolvedFilter === "false") {
    conditions.push(eq(changeComments.resolved, false));
  } else if (resolvedFilter === "true") {
    conditions.push(eq(changeComments.resolved, true));
  }

  return db
    .select()
    .from(changeComments)
    .where(and(...conditions))
    .orderBy(changeComments.createdAt);
});
