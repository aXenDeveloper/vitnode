import { buildRoute } from "@vitnode/core/api/lib/route";

import { CONFIG_PLUGIN } from "@/const";
import { zonesLayoutContentType } from "@/content/zones-layout";

import {
  writeExampleZonesLayout,
  zodExampleZonesFields,
  zodExampleZonesLayout,
} from "../../../zones/lib/layout";

export const saveZonesLayoutAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: {
    module: zonesLayoutContentType.permissionModule,
    permission: "can_edit",
  },
  route: {
    method: "put",
    description:
      "Replace the stored layout of the /example/zones playground - one field per zone",
    path: "/layout",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodExampleZonesFields,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodExampleZonesLayout,
          },
        },
        description: "The layout as it was stored",
      },
    },
  },
  handler: async c =>
    c.json(await writeExampleZonesLayout(c, c.req.valid("json")), 200),
});
