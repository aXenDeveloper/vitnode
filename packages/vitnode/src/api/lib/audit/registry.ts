import { z } from "@hono/zod-openapi";

import type { AuditActionDefinition } from "@/lib/audit/actions";

import { CONTENT_AUDIT_ACTIONS, CORE_AUDIT_ACTIONS } from "@/lib/audit/actions";
import { AUDIT_CORE_PLUGIN_ID } from "@/lib/audit/const";

/** A declared audit action, with the plugin it is recorded under. */
export interface RegisteredAuditAction extends AuditActionDefinition {
  pluginId: string;
}

/**
 * Every audit action an install can record: core's own, the Content Engine's
 * for each plugin that ships content types, and each plugin's declared
 * `auditActions`. Read once at boot for the Activity Logs filters.
 */
export const collectAuditActions = (
  plugins: readonly {
    auditActions?: readonly AuditActionDefinition[];
    contentTypes?: readonly { id: string }[];
    pluginId: string;
  }[],
): RegisteredAuditAction[] => {
  const actions: RegisteredAuditAction[] = CORE_AUDIT_ACTIONS.map(entry => ({
    ...entry,
    pluginId: AUDIT_CORE_PLUGIN_ID,
  }));

  for (const plugin of plugins) {
    if ((plugin.contentTypes ?? []).length > 0) {
      actions.push(
        ...CONTENT_AUDIT_ACTIONS.map(action => ({
          action,
          pluginId: plugin.pluginId,
          targetType: "content",
        })),
      );
    }
    for (const entry of plugin.auditActions ?? []) {
      actions.push({ ...entry, pluginId: plugin.pluginId });
    }
  }

  return actions;
};

/** What the Activity Logs filters offer: the declared actions and the installed plugins. */
export const auditFilterOptions = (core: {
  auditActions: readonly RegisteredAuditAction[];
  installedPlugins: {
    plugins: readonly { icon: null | string; id: string; title: string }[];
  };
}) => ({
  actions: core.auditActions.map(({ action, pluginId, targetType }) => ({
    action,
    pluginId,
    targetType,
  })),
  // Core is not an installed plugin, but its own entries need a filter too.
  plugins: [
    ...(core.installedPlugins.plugins.some(
      plugin => plugin.id === AUDIT_CORE_PLUGIN_ID,
    )
      ? []
      : [{ icon: null, id: AUDIT_CORE_PLUGIN_ID, title: "VitNode" }]),
    ...core.installedPlugins.plugins.map(({ icon, id, title }) => ({
      icon,
      id,
      title,
    })),
  ],
});

/** {@link auditFilterOptions} as an OpenAPI schema. */
export const zodAuditFilterOptions = z.object({
  actions: z.array(
    z.object({
      action: z.string(),
      pluginId: z.string(),
      targetType: z.string(),
    }),
  ),
  /** Installed plugins. An entry naming any other plugin id is from a removed one. */
  plugins: z.array(
    z.object({
      icon: z.string().nullable(),
      id: z.string(),
      title: z.string(),
    }),
  ),
});
