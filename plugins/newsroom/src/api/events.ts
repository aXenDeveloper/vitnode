import { z } from "zod";

import { defineEvent } from "@/api/builders";

/** An editor filed a correction on an article. Emitted after it is committed. */
export const correctionFiledEvent = defineEvent({
  name: "newsroom.correction.filed",
  payload: z.object({
    articleId: z.number().int().positive(),
    correctionId: z.number().int().positive(),
  }),
});
