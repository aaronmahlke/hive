import { db } from "../../../../database";
import { changeComments } from "../../../../database/schema";
import { inArray } from "drizzle-orm";

/**
 * Batch resolve change comments by IDs.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ ids: string[] }>(event);

  if (!body.ids?.length) {
    throw createError({ statusCode: 400, message: "ids array is required" });
  }

  await db
    .update(changeComments)
    .set({ resolved: true })
    .where(inArray(changeComments.id, body.ids));

  return { resolved: body.ids.length };
});
