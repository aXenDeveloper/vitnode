import { z } from "zod";

import { zodRichTextDocument } from "@/content/rich-text/document";

export const zodSiteStatusAdmin = z.object({
  offline: z.boolean(),
  message: z.array(
    z.object({ languageCode: z.string(), value: zodRichTextDocument }),
  ),
  opensAt: z.string().nullable(),
  showCountdown: z.boolean(),
  /** When `offline` last flipped; `null` before the first save. */
  changedAt: z.string().nullable(),
  changedBy: z
    .object({ id: z.number(), name: z.string(), nameCode: z.string() })
    .nullable(),
});
