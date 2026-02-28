import { db } from "../../../../database";
import { changeComments } from "../../../../database/schema";
import { eq } from "drizzle-orm";

/**
 * Delete a single change comment.
 */
export default defineEventHandler(async (event) => {
  const commentId = getRouterParam(event, "commentId");
  if (!commentId) {
    throw createError({ statusCode: 400, message: "commentId is required" });
  }

  await db.delete(changeComments).where(eq(changeComments.id, commentId));

  return { deleted: true };
});
