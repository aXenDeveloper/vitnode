import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { assertStaffPermission } from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
import { zodContentNode } from "@/blocks/validate";
import { EDITABLE_PAGE_ID_MAX_LENGTH } from "@/content/editor/const";

import {
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
  pageId: z.string().min(1).max(EDITABLE_PAGE_ID_MAX_LENGTH),
  zones: zodZones,
});

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
        "Save the zones of one registered page. Gated on that page's own moderator permission, and answers with the canonical stored value of the submitted zones only.",
      request: {
        body: { content: { "application/json": { schema: saveBody } } },
      },
      responses: { 200: jsonResponse("The submitted zones, as stored") },
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

      for (const zoneId of submitted) requireEditablePageZone(page, zoneId);

      const { changed, row } = await savePageLayout(c, {
        page,
        zones: parsePageLayoutZones({ page, zones: body.zones }),
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
