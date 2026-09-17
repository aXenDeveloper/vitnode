import { buildRoute } from "@vitnode/core/api/lib/route";

import { CONFIG_PLUGIN } from "@/const";

import { readExampleZonesLayout, zodExampleZonesLayout } from "../lib/layout";

export const getZonesLayoutRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "Read the single stored layout of the /example/zones playground, or the shipped defaults when nothing has been saved yet",
    path: "/layout",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodExampleZonesLayout,
          },
        },
        description: "The stored layout, or the defaults",
      },
    },
  },
  handler: async c => c.json(await readExampleZonesLayout(c), 200),
});
