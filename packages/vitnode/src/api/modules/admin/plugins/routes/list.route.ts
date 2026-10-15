import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

const registrationSchema = z
  .object({
    /** `null` when this side registered the plugin without a known version. */
    version: z.string().nullable(),
  })
  .nullable();

export const listPluginsAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "plugins", permission: "can_view" },
  route: {
    method: "get",
    description:
      "The plugins this application is configured with, from its build-generated metadata",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              core: z.object({ version: z.string() }),
              /** Whether the API was given the web build's plugin inventory. */
              frontendInventory: z.boolean(),
              plugins: z.array(
                z.object({
                  id: z.string(),
                  title: z.string(),
                  description: z.string().nullable(),
                  version: z.string().nullable(),
                  versionMismatch: z.boolean(),
                  registrations: z.object({
                    api: registrationSchema,
                    frontend: registrationSchema,
                  }),
                }),
              ),
            }),
          },
        },
        description: "Installed plugins",
      },
      403: { description: "Access Denied" },
    },
  },
  handler: c => {
    const { frontendInventory, plugins } = c.get("core").installedPlugins;

    return c.json({
      core: { version: CONFIG_PLUGIN.version },
      frontendInventory,
      plugins,
    });
  },
});
