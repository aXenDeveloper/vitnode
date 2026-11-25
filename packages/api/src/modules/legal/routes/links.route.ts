import { inArray } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_legal_versions } from "@/database/legal";
import {
  LEGAL_DOCUMENT_TYPES,
  legalPageCacheTag,
  localizeLegalContent,
  zodLegalLinks,
} from "@/lib/legal/contract";
import { loadLegalTimelines } from "@/lib/legal/state.server";
import { setPageCacheTags } from "@/lib/page-cache";

import { zodLocaleQuery } from "../legal.schema";

export const linksLegalRoute = buildRoute({
  route: {
    method: "get",
    description:
      "The effective Terms of Service and Privacy Policy versions with their titles, for footer and sign-up links. `null` for a type with no effective version.",
    path: "/links",
    request: { query: zodLocaleQuery },
    responses: {
      200: {
        content: { "application/json": { schema: zodLegalLinks } },
        description: "Links",
      },
    },
  },
  handler: async c => {
    const locale =
      c.req.valid("query").locale ?? c.get("core").i18n.defaultLocale;
    const timelines = await loadLegalTimelines(c);
    const ids = LEGAL_DOCUMENT_TYPES.flatMap(type => {
      const current = timelines[type].current;

      return current ? [current.id] : [];
    });
    const rows =
      ids.length === 0
        ? []
        : await c
            .get("db")
            .select({
              body: core_legal_versions.body,
              acceptanceLabel: core_legal_versions.acceptanceLabel,
              defaultLanguageCode: core_legal_versions.defaultLanguageCode,
              documentType: core_legal_versions.documentType,
              id: core_legal_versions.id,
              summary: core_legal_versions.summary,
              title: core_legal_versions.title,
              version: core_legal_versions.version,
            })
            .from(core_legal_versions)
            .where(inArray(core_legal_versions.id, ids));
    setPageCacheTags(c, LEGAL_DOCUMENT_TYPES.map(legalPageCacheTag));

    const linkOf = (type: (typeof LEGAL_DOCUMENT_TYPES)[number]) => {
      const row = rows.find(item => item.documentType === type);
      if (!row) return null;

      return {
        id: row.id,
        title: localizeLegalContent(row, locale, row.defaultLanguageCode).title,
        version: row.version,
      };
    };

    return c.json({ privacy: linkOf("privacy"), terms: linkOf("terms") }, 200);
  },
});
