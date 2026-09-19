import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
import { zodContentNode } from "@/blocks/validate";
import { EDITABLE_PAGE_ID_MAX_LENGTH } from "@/content/editor/const";

import {
  canonicalPageLayoutZones,
  findEditablePage,
  pageLayoutPayload,
  parsePageLayoutZones,
  readPageLayout,
  requireEditablePageZone,
  savePageLayout,
} from "./page-layout-service";

const zodZones = z.record(z.string(), z.array(zodContentNode));

const zodLayoutPayload = z.object({
  pageId: z.string(),
  updatedAt: z.string().nullable(),
  zones: zodZones,
});

const layoutQuery = z.object({
  pageId: z.string().min(1).max(EDITABLE_PAGE_ID_MAX_LENGTH),
});

const saveBody = z.object({
  expectedZones: zodZones,
  pageId: z.string().min(1).max(EDITABLE_PAGE_ID_MAX_LENGTH),
  zones: zodZones,
});

const quoted = (values: readonly string[]): string =>
  values.map(value => JSON.stringify(value)).join(", ");

const jsonResponse = (description: string) => ({
  content: { "application/json": { schema: zodLayoutPayload } },
  description,
});

export const buildPageLayoutRoutes = <P extends string>({
  pluginId,
}: {
  pluginId: P;
}) => {
  const read = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/layout",
      description:
        "Read one registered page's effective layout: the zones it declares, each one the stored override or the shipped default. Public, because a visitor renders the page from it. An unknown page id is a 404.",
      request: { query: layoutQuery },
      responses: { 200: jsonResponse("The page's layout") },
    },
    handler: async c => {
      const { pageId } = layoutQuery.parse(c.req.query());
      const entry = findEditablePage(c, pageId);

      if (!entry) {
        throw new HTTPException(404, {
          message: `No page is registered as ${JSON.stringify(pageId)}.`,
        });
      }

      const { page } = entry;

      return c.json(
        pageLayoutPayload({
          page,
          row: await readPageLayout(c, page.id),
          zoneIds: page.zoneIds,
        }),
        200,
      );
    },
  });

  const save = buildRoute({
    pluginId,
    route: {
      method: "put",
      path: "/layout",
      description:
        "Save the zones of one registered page. Gated on that page's own moderator permission, and answers with the canonical stored value of the submitted zones only. `expectedZones` carries, for each submitted zone, the value the editor started from: a zone whose stored value moved since then is a 409 and nothing is written, while two people editing different zones of the same page both succeed.",
      request: {
        body: { content: { "application/json": { schema: saveBody } } },
      },
      responses: {
        200: jsonResponse("The submitted zones, as stored"),
        409: {
          description:
            "A submitted zone moved since the editor read it. Nothing was written.",
        },
      },
    },
    handler: async c => {
      const body = saveBody.parse(await c.req.json());
      const entry = findEditablePage(c, body.pageId);

      if (!entry) {
        throw new HTTPException(400, {
          message: `No page is registered as ${JSON.stringify(body.pageId)}, so there is nothing this save could be writing.`,
        });
      }

      const { page, permission } = entry;

      await assertStaffPermission(c, { ...permission, type: "moderator" });

      const submitted = Object.keys(body.zones);

      if (submitted.length === 0) {
        throw new HTTPException(400, {
          message: `A save names the zones it changed, and this one named none.`,
        });
      }

      const expected = Object.keys(body.expectedZones);

      if (
        expected.length !== submitted.length ||
        !submitted.every(zoneId => Object.hasOwn(body.expectedZones, zoneId))
      ) {
        throw new HTTPException(400, {
          message: `A save carries, for every zone it writes, the value it expects to be replacing. This one writes ${quoted(submitted)} and expects ${quoted(expected)}. Without a baseline for each zone the server cannot tell an edit from an overwrite of somebody else's work, so nothing was stored.`,
        });
      }

      for (const zoneId of submitted) requireEditablePageZone(page, zoneId);

      const zones = parsePageLayoutZones({ page, zones: body.zones });
      const expectedZones = canonicalPageLayoutZones({
        page,
        zones: body.expectedZones,
      });

      const { changed, row } = await savePageLayout(c, {
        expectedZones,
        page,
        zones,
      });

      if (changed.length > 0) {
        await c
          .get("events")
          .emit(
            "core.page-layout.updated",
            { changedZones: changed, pageId: page.id },
            { pluginId },
          );
      }

      return c.json(pageLayoutPayload({ page, row, zoneIds: submitted }), 200);
    },
  });

  return [read, save];
};
