import { OpenAPIHono } from "@hono/zod-openapi";

import type { CronJobConfig } from "./cron";
import type { BuildModuleDefinition } from "./module";

import { checkPluginId } from "./check-plugin-id";

export interface BuildPluginApiReturn {
  cronJobs: Omit<CronJobConfig, "pluginId">[];
  hono: OpenAPIHono;
  pluginId: string;
}

export function buildApiPlugin<P extends string>({
  pluginId,
  modules = [],
}: {
  modules?: BuildModuleDefinition<string>[];
  pluginId: P;
}): BuildPluginApiReturn {
  // Run for checking if the plugin is valid
  checkPluginId(pluginId);

  const hono = new OpenAPIHono();
  const cronJobs: BuildPluginApiReturn["cronJobs"] = [];
  modules.forEach(handler => {
    const moduleInstance = handler.build(pluginId);

    hono.route(`/${moduleInstance.name}`, moduleInstance.hono);

    moduleInstance.cronJobs?.forEach(cron => {
      cronJobs.push({ ...cron, module: moduleInstance.name });
    });
  });

  return {
    pluginId,
    hono,
    cronJobs,
  };
}
