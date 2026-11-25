import { z } from "zod";

import { zodLegalDocumentType } from "@/lib/legal/contract";

export const zodLocaleQuery = z.object({
  locale: z.string().min(1).max(32).optional(),
});

export const zodDocumentParam = z.object({
  documentType: zodLegalDocumentType,
});

export const zodVersionParam = zodDocumentParam.extend({
  version: z.coerce.number().int().positive(),
});
