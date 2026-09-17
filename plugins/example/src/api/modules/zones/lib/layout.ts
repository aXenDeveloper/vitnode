import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { ContentDatabase } from "@vitnode/core/content/server";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import {
  AREA_ALIGNS,
  AREA_COLUMNS,
  AREA_GAPS,
  AREA_JUSTIFIES,
  CONTENT_AREA_KIND,
} from "@vitnode/core/blocks";
import { withHttpErrors } from "@vitnode/core/content/server";
import { eq, sql } from "drizzle-orm";

import type { ExampleZonesFields } from "@/content/zones-layout-fields";

import {
  DEFAULT_EXAMPLE_ZONES_LAYOUT,
  EXAMPLE_ZONES_LAYOUT_SLUG,
  EXAMPLE_ZONES_LAYOUT_TITLE,
} from "@/content/zones-layout-fields";
import {
  example_zones_layouts,
  zonesLayoutContent,
} from "@/database/zones-layouts";

const zodBlockNode = z.object({
  data: z.record(z.string(), z.unknown()),
  id: z.string(),
  type: z.string(),
  variant: z.string().optional(),
});

const zodAreaNode = z.object({
  children: z.array(zodBlockNode).readonly(),
  id: z.string(),
  kind: z.literal(CONTENT_AREA_KIND),
  layout: z.object({
    align: z.enum(AREA_ALIGNS).optional(),
    columns: z.literal(AREA_COLUMNS),
    gap: z.enum(AREA_GAPS).optional(),
    justify: z.enum(AREA_JUSTIFIES).optional(),
  }),
});

const zodZoneNodes = z.array(z.union([zodAreaNode, zodBlockNode]));

export const zodExampleZonesFields = z.object({
  afterProfile: zodZoneNodes,
  beforeFooter: zodZoneNodes,
  beforeProfile: zodZoneNodes,
  sidebar: zodZoneNodes,
});

export const zodExampleZonesLayout = z.object({
  fields: zodExampleZonesFields,
  source: z.enum(["defaults", "stored"]),
  updatedAt: z.string().nullable(),
});

export interface ExampleZonesLayoutResponse {
  fields: ExampleZonesFields;
  source: "defaults" | "stored";
  updatedAt: null | string;
}

const EXAMPLE_ZONES_LAYOUT_ADVISORY_LOCK = 8_140_317;

const findLayoutId = async (db: ContentDatabase): Promise<null | number> => {
  const [row] = await db
    .select({ id: example_zones_layouts.id })
    .from(example_zones_layouts)
    .where(eq(example_zones_layouts.slug, EXAMPLE_ZONES_LAYOUT_SLUG))
    .limit(1);

  return row?.id ?? null;
};

const toResponse = (row: {
  afterProfile: ExampleZonesFields["afterProfile"];
  beforeFooter: ExampleZonesFields["beforeFooter"];
  beforeProfile: ExampleZonesFields["beforeProfile"];
  sidebar: ExampleZonesFields["sidebar"];
  updatedAt: Date;
}): ExampleZonesLayoutResponse => ({
  fields: {
    afterProfile: row.afterProfile,
    beforeFooter: row.beforeFooter,
    beforeProfile: row.beforeProfile,
    sidebar: row.sidebar,
  },
  source: "stored",
  updatedAt: row.updatedAt.toISOString(),
});

const defaultsResponse = (): ExampleZonesLayoutResponse => ({
  fields: DEFAULT_EXAMPLE_ZONES_LAYOUT,
  source: "defaults",
  updatedAt: null,
});

export const readExampleZonesLayout = async (
  c: Context<EnvVitNode>,
): Promise<ExampleZonesLayoutResponse> => {
  const id = await findLayoutId(c.get("db"));
  if (id === null) return defaultsResponse();

  const row = await zonesLayoutContent.service(c).findById(id);

  if (!row) {
    throw new Error(
      `The example zones layout row ${id} was found by slug but could not be read. Answering with the shipped defaults here would let the next save overwrite whatever that row actually holds, so this is reported as a failure instead.`,
    );
  }

  return toResponse(row);
};

export const writeExampleZonesLayout = async (
  c: Context<EnvVitNode>,
  fields: ExampleZonesFields,
): Promise<ExampleZonesLayoutResponse> =>
  await withHttpErrors(
    "update",
    async () =>
      await c.get("db").transaction(async tx => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(${EXAMPLE_ZONES_LAYOUT_ADVISORY_LOCK})`,
        );

        const service = zonesLayoutContent.service(c);
        const id = await findLayoutId(tx);

        if (id === null) {
          return toResponse(
            await service.create(
              {
                ...fields,
                slug: EXAMPLE_ZONES_LAYOUT_SLUG,
                title: EXAMPLE_ZONES_LAYOUT_TITLE,
              },
              { tx },
            ),
          );
        }

        const result = await service.update(id, fields, { tx });
        if (!result) {
          throw new Error(
            "The example zones layout row disappeared while it was being saved.",
          );
        }

        return toResponse(result.row);
      }),
    { contentTypeId: zonesLayoutContent.definition.id },
  );
