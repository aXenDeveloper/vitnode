import type { z } from "@hono/zod-openapi";
import type { Context } from "hono";

import { REPORT_REASON_WORDS } from "@/api/lib/moderation/report-reasons";
import { saveLanguageWords } from "@/api/lib/save-language-words";

import type { descriptionSchema, reasonBody } from "../report-reasons.schema";

const filledIn = (values: z.infer<typeof descriptionSchema>) =>
  values.filter(item => item.value.length > 0);

export const saveReasonWords = async (
  c: Context,
  reasonId: number,
  body: Partial<z.infer<typeof reasonBody>>,
) => {
  if (body.title !== undefined) {
    await saveLanguageWords(c, {
      ...REPORT_REASON_WORDS,
      itemId: reasonId,
      values: filledIn(body.title),
      variable: "title",
    });
  }
  if (body.description !== undefined) {
    await saveLanguageWords(c, {
      ...REPORT_REASON_WORDS,
      itemId: reasonId,
      values: filledIn(body.description),
      variable: "description",
    });
  }
};
