import { delegateTask } from "../../services/orchestrator";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    projectId: string;
    branchName: string;
    taskDescription: string;
    linearIssueId?: string;
    linearIssueIdentifier?: string;
    linearIssueDescription?: string;
  }>(event);

  if (!body.projectId || !body.branchName || !body.taskDescription) {
    throw createError({
      statusCode: 400,
      message: "projectId, branchName, and taskDescription are required",
    });
  }

  try {
    const result = await delegateTask({
      projectId: body.projectId,
      branchName: body.branchName,
      taskDescription: body.taskDescription,
      linearIssueId: body.linearIssueId,
      linearIssueIdentifier: body.linearIssueIdentifier,
      linearIssueDescription: body.linearIssueDescription,
    });

    return {
      success: true,
      worktreeId: result.worktreeId,
      sessionId: result.sessionId,
    };
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      message: `Failed to delegate task: ${e.message}`,
    });
  }
});
