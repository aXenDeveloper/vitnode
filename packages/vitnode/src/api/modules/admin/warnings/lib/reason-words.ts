import type { z } from "@hono/zod-openapi";
import type { Context } from "hono";

import { WARNING_REASON_WORDS } from "@/api/lib/moderation/warnings/reasons";
import { saveLanguageWords } from "@/api/lib/save-language-words";

import type { reasonBody } from "../warning-reasons.schema";

export const saveReasonWords = async (
  c: Context,
  reasonId: number,
  body: Partial<z.infer<typeof reasonBody>>,
) => {
  await Promise.all(
    (["title", "description", "message"] as const).map(async variable => {
      const values = body[variable];
      if (values === undefined) return;
      await saveLanguageWords(c, {
        ...WARNING_REASON_WORDS,
        itemId: reasonId,
        values: values.filter(item => item.value.length > 0),
        variable,
      });
    }),
  );
};
