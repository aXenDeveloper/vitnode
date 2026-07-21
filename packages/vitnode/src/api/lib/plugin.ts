import { OpenAPIHono } from "@hono/zod-openapi";

import type { SearchIndexer } from "../models/search";
import type { CronJobConfig } from "./cron";
import type { BuildModuleReturn } from "./module";
import type { PermissionStaffConfig } from "./permission-staff";
import type { QueueTaskConfig } from "./queue";
import type { WebSocketConfig } from "./websocket";

import { checkPluginId } from "./check-plugin-id";

export interface BuildPluginApiReturn {
  cronJobs?: Omit<CronJobConfig, "pluginId">[];
  hono: OpenAPIHono;
  permissionStaff?: PermissionStaffConfig;
  pluginId: string;
  queueTasks?: Omit<QueueTaskConfig, "pluginId">[];
  searchIndexers?: SearchIndexer[];
  webSockets?: Omit<WebSocketConfig, "pluginId">[];
}

export function buildApiPlugin<P extends string>({
  pluginId,
  modules = [],
  permissionStaff,
  searchIndexers,
}: {
  modules?: BuildModuleReturn<P, string>[];
  permissionStaff?: PermissionStaffConfig;
  pluginId: P;
  searchIndexers?: SearchIndexer[];
}): BuildPluginApiReturn {
  // Run for checking if the plugin is valid
  checkPluginId(pluginId);

  const hono = new OpenAPIHono();
  const cronJobs: BuildPluginApiReturn["cronJobs"] = [];
  const queueTasks: BuildPluginApiReturn["queueTasks"] = [];
  const webSockets: BuildPluginApiReturn["webSockets"] = [];
  modules.forEach(handler => {
    hono.route(`/${handler.name}`, handler.hono);

    handler.cronJobs?.forEach(cron => {
      cronJobs.push({ ...cron, module: handler.name });
    });

    handler.queueTasks?.forEach(task => {
      queueTasks.push({ ...task, module: handler.name });
    });

    handler.webSockets?.forEach(webSocket => {
      webSockets.push({ ...webSocket, module: handler.name });
    });
  });

  return {
    pluginId,
    hono,
    cronJobs,
    queueTasks,
    searchIndexers,
    webSockets,
    permissionStaff,
  };
}
