import { OpenAPIHono } from "@hono/zod-openapi";
import { checkPluginId } from "./check-plugin-id";
import type { BuildCronReturn } from "./cron";
import type { BuildModuleReturn } from "./module";

export interface BuildPluginApiReturn {
  hono: OpenAPIHono;
  pluginId: string;
  cronJobs: ({ module: string } & BuildCronReturn)[];
}

export function buildApiPlugin<P extends string>({
  pluginId,
  modules = [],
}: {
  modules?: BuildModuleReturn<P, string>[];
  pluginId: P;
}): BuildPluginApiReturn {
  // Run for checking if the plugin is valid
  checkPluginId(pluginId);

  const hono = new OpenAPIHono();
  const cronJobs: BuildPluginApiReturn["cronJobs"] = [];
  modules.forEach(handler => {
    hono.route(`/${handler.name}`, handler.hono);

    handler.cronJobs?.forEach(cron => {
      cronJobs.push({ ...cron, module: handler.name });
    });
  });

  return {
    pluginId,
    hono,
    cronJobs,
  };
}
