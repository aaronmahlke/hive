import { db } from "../../../../database";
import { changeComments } from "../../../../database/schema";
import { eq, and } from "drizzle-orm";

/**
 * List change comments for a project.
 * Query params: ?resolved=false to filter only unresolved.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const query = getQuery(event);
  const resolvedFilter = query.resolved;

  const conditions = [eq(changeComments.projectId, id)];

  if (resolvedFilter === "false") {
    conditions.push(eq(changeComments.resolved, false));
  } else if (resolvedFilter === "true") {
    conditions.push(eq(changeComments.resolved, true));
  }

  const comments = await db
    .select()
    .from(changeComments)
    .where(and(...conditions))
    .orderBy(changeComments.createdAt);

  return comments;
});
