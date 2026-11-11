import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import { requireModerator } from "@/api/lib/moderation/access";
import { ContentSubmissionDecisionError } from "@/content/approvals/server/decide";
import {
  canReviewSubmission,
  findContentSubmission,
  reviewableContentTypes,
} from "@/content/approvals/server/queue";

export const decisionError = (error: unknown): never => {
  if (error instanceof ContentSubmissionDecisionError) {
    throw new HTTPException(error.status, {
      res: Response.json(
        { error: error.code, message: error.message },
        { status: error.status },
      ),
    });
  }

  throw error;
};

/** 404 for a submission the moderator may not review - its existence is not theirs to know. */
export const reviewableSubmission = async (c: Context, id: number) => {
  const moderator = await requireModerator(c);
  const row = await findContentSubmission(c, id);
  if (
    !row ||
    !canReviewSubmission(await reviewableContentTypes(c, moderator.set), row)
  ) {
    throw new HTTPException(404, {
      res: Response.json(
        { error: "notFound", message: "No such submission." },
        { status: 404 },
      ),
    });
  }

  return { moderator, row };
};
