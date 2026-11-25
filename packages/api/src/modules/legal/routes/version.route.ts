import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import {
  legalPageCacheTag,
  zodLegalVersionDocument,
} from "@/lib/legal/contract";
import {
  legalRequestLocale,
  loadLegalVersionDocument,
} from "@/lib/legal/public.server";
import { setPageCacheTags } from "@/lib/page-cache";

import { zodLocaleQuery, zodVersionParam } from "../legal.schema";

export const versionLegalRoute = buildRoute({
  route: {
    method: "get",
    description:
      "One announced version of a legal document at its stable address. Announced versions never change.",
    path: "/{documentType}/versions/{version}",
    request: { params: zodVersionParam, query: zodLocaleQuery },
    responses: {
      200: {
        content: { "application/json": { schema: zodLegalVersionDocument } },
        description: "Version",
      },
      404: { description: "No such version" },
    },
  },
  handler: async c => {
    const { documentType, version } = c.req.valid("param");
    const locale = legalRequestLocale(c, c.req.valid("query").locale);
    const document = await loadLegalVersionDocument(
      c,
      documentType,
      version,
      locale,
    );
    if (!document) throw new HTTPException(404);
    setPageCacheTags(c, [legalPageCacheTag(documentType)]);

    return c.json(document, 200);
  },
});
