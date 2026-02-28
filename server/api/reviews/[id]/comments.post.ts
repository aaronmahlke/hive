import { db } from "../../../database";
import { reviewComments } from "../../../database/schema";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  const reviewId = getRouterParam(event, "id");
  const body = await readBody<{
    filePath: string;
    lineNumber?: number;
    side?: "left" | "right";
    author: "user" | "worker" | "reviewer";
    content: string;
  }>(event);

  if (!reviewId || !body.filePath || !body.content || !body.author) {
    throw createError({
      statusCode: 400,
      message: "reviewId, filePath, author, and content are required",
    });
  }

  const [comment] = await db
    .insert(reviewComments)
    .values({
      id: nanoid(),
      reviewId,
      filePath: body.filePath,
      lineNumber: body.lineNumber,
      side: body.side,
      author: body.author,
      content: body.content,
    })
    .returning();

  return comment;
});
