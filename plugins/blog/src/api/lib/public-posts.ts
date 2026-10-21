import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { ContentPublicHiddenAccess } from "@vitnode/core/content/server";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import {
  contentPublicListCondition,
  contentTranslationPublicationColumns,
  findContentLanguage,
  publishedCondition,
} from "@vitnode/core/content/server";
import { and, eq, exists, or, sql } from "drizzle-orm";

import { postContent } from "@/database/posts";

const { definition } = postContent;
const columns = postContent.columns as Record<string, PgColumn>;
const translationColumns = postContent.translationColumns as Record<
  string,
  PgColumn
>;
const translationTable = (() => {
  const table = postContent.translationTable;
  if (!table) {
    throw new Error(
      "Blog articles are localized, so they have a translation table.",
    );
  }

  return table;
})();

const publishedTranslationIn = (
  c: Context<EnvVitNode>,
  languageId: number,
): SQL =>
  exists(
    c
      .get("db")
      .select({ one: sql`1` })
      .from(translationTable)
      .where(
        and(
          eq(translationColumns.itemId, columns.id),
          eq(translationColumns.languageId, languageId),
          publishedCondition(
            contentTranslationPublicationColumns(
              definition,
              translationColumns,
            ),
          ),
        ),
      ),
  );

export const publicPostConditionIn = async (
  c: Context<EnvVitNode>,
  locale: string | undefined,
  hidden?: ContentPublicHiddenAccess,
): Promise<null | SQL | undefined> => {
  const { defaultLocale, fallback } = definition.localization;
  const requested = await findContentLanguage(c, locale ?? defaultLocale);
  if (!requested?.isEnabled) return null;

  const fallbackTo =
    fallback === "default" ? await findContentLanguage(c, defaultLocale) : null;
  const direct = publishedTranslationIn(c, requested.id);

  return and(
    contentPublicListCondition(
      { advanced: postContent.advanced, columns, definition },
      hidden,
    ),
    fallbackTo && fallbackTo.id !== requested.id
      ? or(direct, publishedTranslationIn(c, fallbackTo.id))
      : direct,
  );
};
