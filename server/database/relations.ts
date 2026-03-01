import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  projects: {
    worktrees: r.many.worktrees(),
    changeComments: r.many.changeComments(),
  },
  worktrees: {
    project: r.one.projects({
      from: r.worktrees.projectId,
      to: r.projects.id,
    }),
    sessions: r.many.sessions(),
    reviews: r.many.reviews(),
  },
  sessions: {
    worktree: r.one.worktrees({
      from: r.sessions.worktreeId,
      to: r.worktrees.id,
    }),
    signals: r.many.signals(),
  },
  signals: {
    session: r.one.sessions({
      from: r.signals.sessionId,
      to: r.sessions.id,
    }),
  },
  reviews: {
    worktree: r.one.worktrees({
      from: r.reviews.worktreeId,
      to: r.worktrees.id,
    }),
    comments: r.many.reviewComments(),
  },
  reviewComments: {
    review: r.one.reviews({
      from: r.reviewComments.reviewId,
      to: r.reviews.id,
    }),
  },
  changeComments: {
    project: r.one.projects({
      from: r.changeComments.projectId,
      to: r.projects.id,
    }),
  },
}));
