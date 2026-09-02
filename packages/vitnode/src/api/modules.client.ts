import type { BaseBuildModuleReturn } from "@/api/lib/module";
import type { adminModule as adminModuleType } from "@/api/modules/admin/admin.module";
import type { cronAdminModule as cronAdminModuleType } from "@/api/modules/admin/advanced/cron/cron.admin.module";
import type { queueAdminModule as queueAdminModuleType } from "@/api/modules/admin/advanced/queue/queue.admin.module";
import type { debugAdminModule as debugAdminModuleType } from "@/api/modules/admin/debug/debug.admin.module";
import type { filesAdminModule as filesAdminModuleType } from "@/api/modules/admin/files/files.admin.module";
import type { middlewareModule as middlewareModuleType } from "@/api/modules/middleware/middleware.module";
import type { searchModule as searchModuleType } from "@/api/modules/search/search.module";
import type { userFilesModule as userFilesModuleType } from "@/api/modules/users/files/files.module";
import type { usersModule as usersModuleType } from "@/api/modules/users/users.module";

import { CONFIG_PLUGIN } from "@/config";

const moduleFor = <T extends BaseBuildModuleReturn>(
  pluginId: T["pluginId"],
): T => ({ pluginId }) as unknown as T;

export const adminModule = moduleFor<typeof adminModuleType>(
  CONFIG_PLUGIN.pluginId,
);

export const cronAdminModule = moduleFor<typeof cronAdminModuleType>(
  CONFIG_PLUGIN.pluginId,
);

export const debugAdminModule = moduleFor<typeof debugAdminModuleType>(
  CONFIG_PLUGIN.pluginId,
);

export const filesAdminModule = moduleFor<typeof filesAdminModuleType>(
  CONFIG_PLUGIN.pluginId,
);

export const middlewareModule = moduleFor<typeof middlewareModuleType>(
  CONFIG_PLUGIN.pluginId,
);

export const queueAdminModule = moduleFor<typeof queueAdminModuleType>(
  CONFIG_PLUGIN.pluginId,
);

export const searchModule = moduleFor<typeof searchModuleType>(
  CONFIG_PLUGIN.pluginId,
);

export const userFilesModule = moduleFor<typeof userFilesModuleType>(
  CONFIG_PLUGIN.pluginId,
);

export const usersModule = moduleFor<typeof usersModuleType>(
  CONFIG_PLUGIN.pluginId,
);

export const pluginModule = moduleFor;
