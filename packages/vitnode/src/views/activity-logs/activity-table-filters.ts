import React from "react";
import { useTranslations } from "use-intl";

import type { FilterDataTable } from "@/components/table/filters";
import type { AuditStaffLog } from "@/lib/audit/const";

import { AUDIT_AREAS, AUDIT_CORE_PLUGIN_ID } from "@/lib/audit/const";

import type { ActivityFilterOptions } from "./activity-query";

import { useActivityLabels } from "./activity-labels";
import { searchActivityActors } from "./activity-query";

/**
 * Core's report and approval actions are only ever recorded in the moderator
 * area, and core's other actions never are; plugin actions can be either.
 */
const isModerationAction = (action: string) =>
  action.startsWith("report.") || action.startsWith("submission.");

/** The moderator area has a log of its own. */
const ADMIN_LOG_AREAS = AUDIT_AREAS.filter(area => area !== "moderator");

/**
 * The toolbar filters of a staff log, one value each, kept in the URL under
 * the API's own names: plugin, area (admins' log only), action, actor and a
 * date range.
 */
export const useActivityTableFilters = ({
  options,
  pluginId,
  staff,
}: {
  options: ActivityFilterOptions;
  /** The selected plugin - it narrows the actions offered. */
  pluginId?: string;
  staff: AuditStaffLog;
}): FilterDataTable[] => {
  const t = useTranslations("core.activity_logs.filters");
  const tAreas = useTranslations("core.activity_logs.areas");
  const labels = useActivityLabels(options.plugins);

  return React.useMemo(() => {
    const actions = new Map<string, string>();
    for (const entry of options.actions) {
      const fits =
        (!pluginId || entry.pluginId === pluginId) &&
        (staff === "moderator"
          ? entry.pluginId !== AUDIT_CORE_PLUGIN_ID ||
            isModerationAction(entry.action)
          : !isModerationAction(entry.action));
      if (fits && !actions.has(entry.action)) {
        actions.set(
          entry.action,
          labels.action({
            action: entry.action,
            contentTypeId: null,
            pluginId: entry.pluginId,
          }),
        );
      }
    }
    const all = { allLabel: t("all") };

    return [
      {
        id: "pluginId",
        label: t("plugin"),
        options: options.plugins.map(plugin => ({
          label: labels.plugin(plugin.id),
          value: plugin.id,
        })),
        single: all,
      },
      ...(staff === "admin"
        ? [
            {
              id: "area",
              label: t("area"),
              options: ADMIN_LOG_AREAS.map(area => ({
                label: tAreas(area),
                value: area,
              })),
              single: all,
            },
          ]
        : []),
      {
        id: "action",
        label: t("action"),
        options: [...actions]
          .map(([value, label]) => ({ label, value }))
          .sort((a, b) => a.label.localeCompare(b.label)),
        single: all,
      },
      {
        id: "actorId",
        label: t("actor_filter"),
        onSearch: async search =>
          (await searchActivityActors({ search, staff })).map(actor => ({
            label: actor.name,
            value: `${actor.id}`,
          })),
        single: { allLabel: t("everyone") },
      },
    ];
  }, [labels, options, pluginId, staff, t, tAreas]);
};
