import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { manifest } from "@/manifest";

const registrationSchema = z
  .object({
    version: z.string().nullable(),
  })
  .nullable();

export const listPluginsAdminRoute = buildRoute({
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
              frontendInventory: z.boolean(),
              plugins: z.array(
                z.object({
                  id: z.string(),
                  title: z.string(),
                  icon: z.string().nullable(),
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
      core: { version: manifest.version },
      frontendInventory,
      plugins,
    });
  },
});
