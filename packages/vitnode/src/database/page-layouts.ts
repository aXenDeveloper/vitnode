import { camelCase } from "drizzle-orm/pg-core";

import type { ContentNode } from "@/blocks/types";

import { EDITABLE_PAGE_ID_MAX_LENGTH } from "@/content/editor/const";

export type PageLayoutZones = Record<string, ContentNode[]>;

export const core_page_layouts = camelCase.table.withRLS(
  "core_page_layouts",
  t => ({
    pageId: t.varchar({ length: EDITABLE_PAGE_ID_MAX_LENGTH }).primaryKey(),
    zones: t.jsonb().$type<PageLayoutZones>().notNull().default({}),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t.timestamp().notNull().defaultNow(),
  }),
);
