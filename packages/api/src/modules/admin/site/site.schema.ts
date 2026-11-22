import { z } from "zod";

import { zodSiteOfflineMessage } from "@/lib/site-status";

export const zodSiteStatusAdmin = z.object({
  offline: z.boolean(),
  message: zodSiteOfflineMessage,
  opensAt: z.string().nullable(),
  showCountdown: z.boolean(),
  /** When `offline` last flipped; `null` before the first save. */
  changedAt: z.string().nullable(),
  changedBy: z
    .object({ id: z.number(), name: z.string(), nameCode: z.string() })
    .nullable(),
});
