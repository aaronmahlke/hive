import { db } from "../../../../database";
import { changeComments } from "../../../../database/schema";
import { nanoid } from "nanoid";

/**
 * Create a new change comment on a project.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const body = await readBody<{
    filePath: string;
    startLine: number;
    endLine: number;
    side?: "additions" | "deletions";
    content: string;
    sessionId?: string;
  }>(event);

  if (!body.filePath || !body.content || body.startLine == null || body.endLine == null) {
    throw createError({
      statusCode: 400,
      message: "filePath, startLine, endLine, and content are required",
    });
  }

  const [comment] = await db
    .insert(changeComments)
    .values({
      id: nanoid(),
      projectId: id,
      sessionId: body.sessionId || null,
      filePath: body.filePath,
      startLine: body.startLine,
      endLine: body.endLine,
      side: body.side || null,
      content: body.content,
    })
    .returning();

  return comment;
});
