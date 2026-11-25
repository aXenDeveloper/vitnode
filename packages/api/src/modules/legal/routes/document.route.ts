import { buildRoute } from "@/builders";
import {
  legalPageCacheTag,
  zodLegalDocumentOverview,
} from "@/lib/legal/contract";
import {
  legalRequestLocale,
  loadLegalOverview,
} from "@/lib/legal/public.server";
import { setPageCacheTags } from "@/lib/page-cache";

import { zodDocumentParam, zodLocaleQuery } from "../legal.schema";

export const documentLegalRoute = buildRoute({
  route: {
    method: "get",
    description:
      "A legal document's effective version in full, its upcoming version and every announced version, in the requested language with a deterministic fallback. Drafts are never included.",
    path: "/{documentType}",
    request: { params: zodDocumentParam, query: zodLocaleQuery },
    responses: {
      200: {
        content: { "application/json": { schema: zodLegalDocumentOverview } },
        description: "Document",
      },
    },
  },
  handler: async c => {
    const { documentType } = c.req.valid("param");
    const locale = legalRequestLocale(c, c.req.valid("query").locale);
    setPageCacheTags(c, [legalPageCacheTag(documentType)]);

    return c.json(await loadLegalOverview(c, documentType, locale), 200);
  },
});
