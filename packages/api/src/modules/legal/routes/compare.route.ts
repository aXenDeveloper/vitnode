import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { legalPageCacheTag, zodLegalComparison } from "@/lib/legal/contract";
import {
  legalRequestLocale,
  loadLegalComparison,
} from "@/lib/legal/public.server";
import { setPageCacheTags } from "@/lib/page-cache";

import { zodLocaleQuery, zodVersionParam } from "../legal.schema";

export const compareLegalRoute = buildRoute({
  route: {
    method: "get",
    description:
      "What changed in a version: its summary and a block-by-block comparison with its predecessor (or with `from`), both sides in one shared language when possible.",
    path: "/{documentType}/versions/{version}/changes",
    request: {
      params: zodVersionParam,
      query: zodLocaleQuery.extend({
        from: z.coerce.number().int().positive().optional(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodLegalComparison } },
        description: "Comparison",
      },
      404: { description: "No such version" },
    },
  },
  handler: async c => {
    const { documentType, version } = c.req.valid("param");
    const { from, locale } = c.req.valid("query");
    if (from !== undefined && from >= version) {
      throw new HTTPException(400, {
        message: "`from` must be an earlier version.",
      });
    }
    const comparison = await loadLegalComparison(
      c,
      documentType,
      version,
      legalRequestLocale(c, locale),
      from,
    );
    if (!comparison) throw new HTTPException(404);
    setPageCacheTags(c, [legalPageCacheTag(documentType)]);

    return c.json(comparison, 200);
  },
});
