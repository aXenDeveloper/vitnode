import type { z } from "@hono/zod-openapi";

import type { draftSchema } from "../warnings.schema";
import type { WarningDraftInput } from "./warnings";

export const toDraft = (
  input: z.infer<typeof draftSchema>,
): WarningDraftInput => ({
  content: input.content ?? null,
  expiration:
    input.expiration.mode === "at"
      ? { at: new Date(input.expiration.at), mode: "at" }
      : input.expiration,
  points: input.points ?? null,
  reasonId: input.reasonId,
  reportId: input.reportId ?? null,
  userId: input.userId,
});
