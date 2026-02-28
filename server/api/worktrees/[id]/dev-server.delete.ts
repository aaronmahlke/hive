import { db } from "../../../database";
import { worktrees } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { stopDevServer } from "../../../services/process";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  stopDevServer();

  await db
    .update(worktrees)
    .set({ devServerActive: false })
    .where(eq(worktrees.id, id));

  return { success: true };
});
