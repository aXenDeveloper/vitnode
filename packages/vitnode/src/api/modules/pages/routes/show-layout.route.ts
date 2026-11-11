import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/lib/route";
import { EDITABLE_PAGE_ID_MAX_LENGTH } from "@/content/editor/const";

import {
  findEditablePage,
  pageLayoutPayload,
  readPageLayout,
} from "../lib/page-layout";
import { jsonResponse } from "../page-layout.schema";

const layoutQuery = z.object({
  pageId: z.string().min(1).max(EDITABLE_PAGE_ID_MAX_LENGTH),
});

export const buildShowPageLayoutRoute = <P extends string>({
  pluginId,
}: {
  pluginId: P;
}) =>
  buildRoute({
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
