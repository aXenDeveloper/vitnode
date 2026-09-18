import type { Context } from "hono";

import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { RegisteredEditablePage } from "@/api/lib/editable-pages";
import type { ContentNode } from "@/blocks/types";
import type {
  AnyEditablePageDefinition,
  EditablePageLayoutPayload,
  EditablePageZone,
} from "@/content/editor/types";
import type { PageLayoutZones } from "@/database/page-layouts";

import { zodBlockInstances } from "@/blocks/validate";
import { core_page_layouts } from "@/database/page-layouts";

export interface PageLayoutRow {
  pageId: string;
  updatedAt: Date;
  zones: PageLayoutZones;
}

export interface PageLayoutSave {
  changed: string[];
  row: null | PageLayoutRow;
}

type PageLayoutDatabase = Omit<Context["var"]["db"], "$client">;

const quoted = (values: readonly string[]): string =>
  values.map(value => JSON.stringify(value)).join(", ");

const describeStored = (value: unknown): string => {
  if (value === undefined) return "nothing at all";
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  if (typeof value === "object") return "a JSON object";

  return `a ${typeof value} value`;
};

const sameJson = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => sameJson(entry, right[index]))
    );
  }

  if (
    typeof left !== "object" ||
    typeof right !== "object" ||
    left === null ||
    right === null
  ) {
    return false;
  }

  const keys = Object.keys(left);

  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      key =>
        Object.hasOwn(right, key) &&
        sameJson(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
};

export const findEditablePage = (
  c: Context,
  pageId: string,
): RegisteredEditablePage | undefined =>
  c.get("core").editablePages.find(entry => entry.page.id === pageId);

export const requireEditablePageZone = (
  page: AnyEditablePageDefinition,
  zoneId: string,
): EditablePageZone => {
  const zone = Object.hasOwn(page.zones, zoneId)
    ? page.zones[zoneId]
    : undefined;

  if (!zone) {
    throw new HTTPException(400, {
      message: `The page ${JSON.stringify(page.id)} has no zone ${JSON.stringify(zoneId)}. It declares ${quoted(page.zoneIds)}. A zone the page does not declare has no allowlist and no place to be rendered, so it is refused rather than stored where nothing would read it.`,
    });
  }

  return zone;
};

const canonicalDefaults = new WeakMap<EditablePageZone, ContentNode[]>();

const canonicalZoneDefault = (
  page: AnyEditablePageDefinition,
  zone: EditablePageZone,
): ContentNode[] => {
  const memoized = canonicalDefaults.get(zone);
  if (memoized) return memoized;

  const result = zodBlockInstances({
    allowed: zone.allowed,
    max: zone.max,
    min: zone.min,
  }).safeParse(zone.default);

  if (!result.success) {
    throw new HTTPException(500, {
      message: `The shipped default of the ${JSON.stringify(zone.zoneId)} zone of ${JSON.stringify(page.id)} is not a value the zone itself accepts: ${result.error.issues.map(issue => issue.message).join(" ")} Nobody could save that zone back to its default, so the declaration is reported rather than worked around.`,
    });
  }

  canonicalDefaults.set(zone, result.data);

  return result.data;
};

export const parsePageLayoutZones = ({
  page,
  zones,
}: {
  page: AnyEditablePageDefinition;
  zones: Record<string, unknown[]>;
}): PageLayoutZones => {
  const parsed: PageLayoutZones = {};

  for (const zoneId of Object.keys(zones)) {
    const zone = requireEditablePageZone(page, zoneId);
    const result = zodBlockInstances({
      allowed: zone.allowed,
      max: zone.max,
      min: zone.min,
    }).safeParse(zones[zoneId]);

    if (!result.success) {
      throw new HTTPException(400, {
        message: `The ${JSON.stringify(zoneId)} zone of ${JSON.stringify(page.id)} was refused: ${result.error.issues.map(issue => issue.message).join(" ")}`,
      });
    }

    parsed[zoneId] = result.data;
  }

  return parsed;
};

export const pageLayoutPayload = ({
  page,
  row,
  zoneIds,
}: {
  page: AnyEditablePageDefinition;
  row: null | PageLayoutRow;
  zoneIds: readonly string[];
}): EditablePageLayoutPayload => {
  const stored = row?.zones ?? {};
  const zones: Record<string, ContentNode[]> = {};

  for (const zoneId of zoneIds) {
    const zone = requireEditablePageZone(page, zoneId);

    zones[zoneId] = Object.hasOwn(stored, zoneId)
      ? stored[zoneId]
      : [...canonicalZoneDefault(page, zone)];
  }

  return {
    pageId: page.id,
    updatedAt: row === null ? null : row.updatedAt.toISOString(),
    zones,
  };
};

const selectPageLayout = async (
  db: PageLayoutDatabase,
  pageId: string,
): Promise<null | PageLayoutRow> => {
  const [row] = await db
    .select({
      pageId: core_page_layouts.pageId,
      updatedAt: core_page_layouts.updatedAt,
      zones: core_page_layouts.zones,
    })
    .from(core_page_layouts)
    .where(eq(core_page_layouts.pageId, pageId))
    .limit(1);

  if (!row) return null;

  const stored: unknown = row.zones;

  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) {
    throw new HTTPException(500, {
      message: `The stored layout of ${JSON.stringify(pageId)} holds ${describeStored(stored)} rather than a zone-by-zone object. Answering with the shipped defaults would hand the editor a Save that writes them over whatever is really stored: repair the row first.`,
    });
  }

  for (const [zoneId, blocks] of Object.entries(stored)) {
    if (!Array.isArray(blocks)) {
      throw new HTTPException(500, {
        message: `The stored ${JSON.stringify(zoneId)} zone of ${JSON.stringify(pageId)} holds ${describeStored(blocks)} rather than a list of blocks. Answering with the shipped default would hand the editor a Save that writes that default over whatever is really stored: repair the row first.`,
      });
    }
  }

  return { pageId: row.pageId, updatedAt: row.updatedAt, zones: row.zones };
};

export const readPageLayout = async (
  c: Context,
  pageId: string,
): Promise<null | PageLayoutRow> => await selectPageLayout(c.get("db"), pageId);

export const savePageLayout = async (
  c: Context,
  { page, zones }: { page: AnyEditablePageDefinition; zones: PageLayoutZones },
): Promise<PageLayoutSave> =>
  await c.get("db").transaction(async (tx): Promise<PageLayoutSave> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${page.id}))`);

    const current = await selectPageLayout(tx, page.id);
    const stored = current?.zones ?? {};
    const next: PageLayoutZones = { ...stored };
    const changed: string[] = [];

    for (const [zoneId, blocks] of Object.entries(zones)) {
      const zone = requireEditablePageZone(page, zoneId);
      const overridden = Object.hasOwn(stored, zoneId);

      if (sameJson(blocks, canonicalZoneDefault(page, zone))) {
        if (!overridden) continue;

        delete next[zoneId];
        changed.push(zoneId);
        continue;
      }

      if (overridden && sameJson(stored[zoneId], blocks)) continue;

      next[zoneId] = blocks;
      changed.push(zoneId);
    }

    if (changed.length === 0) return { changed, row: current };

    if (Object.keys(next).length === 0) {
      await tx
        .delete(core_page_layouts)
        .where(eq(core_page_layouts.pageId, page.id));

      return { changed, row: null };
    }

    const updatedAt = new Date();
    const [row] = await tx
      .insert(core_page_layouts)
      .values({ pageId: page.id, updatedAt, zones: next })
      .onConflictDoUpdate({
        set: { updatedAt, zones: next },
        target: core_page_layouts.pageId,
      })
      .returning({
        pageId: core_page_layouts.pageId,
        updatedAt: core_page_layouts.updatedAt,
        zones: core_page_layouts.zones,
      });

    return { changed, row };
  });
