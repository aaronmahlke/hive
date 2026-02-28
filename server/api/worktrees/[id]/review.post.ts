import { triggerReview } from "../../../services/orchestrator";

/**
 * Trigger a review for a worktree.
 * This starts the automated review loop.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  try {
    const reviewId = await triggerReview(id);
    return { success: true, reviewId };
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      message: e.message || "Failed to trigger review",
    });
  }
});
