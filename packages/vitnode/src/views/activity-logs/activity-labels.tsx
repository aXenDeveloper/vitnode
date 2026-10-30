import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import type { ContentLabelTranslator } from "@/content/admin/labels";
import type { AuditArea } from "@/lib/audit/const";

import { Badge } from "@/components/ui/badge";
import { UserFormat } from "@/components/user-format";
import {
  contentI18nKeys,
  contentNouns,
  humanizeFieldName,
} from "@/content/admin/labels";
import { AUDIT_CORE_PLUGIN_ID } from "@/lib/audit/const";

import type { ActivityEntry, ActivityFilterOptions } from "./activity-query";

/** The namespaces every Activity Logs screen reads. */
export const ACTIVITY_NAMESPACES = [
  "core.activity_logs",
  "core.global",
] as const;

/**
 * The plugin message subtrees an entry's label may come from: a plugin's own
 * `audit` actions, and the `content` nouns and field names of its content
 * types. Loaded with the screen, so a label never renders as a key.
 */
export const activityPluginNamespaces = (
  plugins: readonly { id: string }[],
): string[] =>
  plugins
    .filter(plugin => plugin.id !== AUDIT_CORE_PLUGIN_ID)
    .flatMap(plugin => [`${plugin.id}.audit`, `${plugin.id}.content`]);

/** `topic.moved` -> "Topic moved": what an action reads as with no translation. */
export const humanizeAuditAction = (action: string): string =>
  humanizeFieldName(action.replaceAll(".", " ").replaceAll("_", " "));

/**
 * Turns stored identifiers into words, in the reader's language - and never
 * runs a plugin's code to do it, so an entry of a removed plugin still reads:
 *
 * - Content Engine actions use core's sentence with the content type's noun
 *   from the plugin's messages (`Updated Category`).
 * - Core actions use core's own messages.
 * - A plugin's action uses `{pluginId}.audit.actions.{action}`, when the plugin
 *   ships one.
 * - Anything else is the action id made readable.
 */
export const useActivityLabels = (
  plugins: ActivityFilterOptions["plugins"] = [],
) => {
  const t = useTranslations("core.activity_logs");
  const tAll = useTranslations() as unknown as ContentLabelTranslator;
  const titles = React.useMemo(
    () => new Map(plugins.map(plugin => [plugin.id, plugin.title])),
    [plugins],
  );

  return React.useMemo(() => {
    const contentNoun = (pluginId: string, contentTypeId: null | string) =>
      // A filter option names the action, not a record of one type.
      contentTypeId
        ? contentNouns({ id: contentTypeId }, pluginId, tAll).singular
        : t("content_noun");

    const action = (
      entry: Pick<ActivityEntry, "action" | "contentTypeId" | "pluginId">,
    ): string => {
      const coreKey = `core.activity_logs.actions.${entry.action}`;
      if (entry.action.startsWith("content.") && tAll.has(coreKey)) {
        return tAll(coreKey, {
          type: contentNoun(entry.pluginId, entry.contentTypeId),
        });
      }
      if (entry.pluginId === AUDIT_CORE_PLUGIN_ID && tAll.has(coreKey)) {
        return tAll(coreKey);
      }
      const pluginKey = `${entry.pluginId}.audit.actions.${entry.action}`;
      if (tAll.has(pluginKey)) return tAll(pluginKey);

      return humanizeAuditAction(entry.action);
    };

    const field = (
      entry: Pick<ActivityEntry, "contentTypeId" | "pluginId">,
      name: string,
    ): string => {
      if (entry.contentTypeId) {
        const key = contentI18nKeys(
          { id: entry.contentTypeId },
          entry.pluginId,
        ).field(name);
        if (tAll.has(key)) return tAll(key);
      }
      const coreKey = `core.activity_logs.fields.${name}`;
      if (tAll.has(coreKey)) return tAll(coreKey);

      return humanizeFieldName(name);
    };

    const plugin = (pluginId: string): string => {
      const title = titles.get(pluginId);
      if (title) return title;
      if (pluginId === AUDIT_CORE_PLUGIN_ID) return "VitNode";

      return t("removed_plugin", { plugin: pluginId });
    };

    const area = (value: AuditArea): string => t(`areas.${value}`);

    const target = (
      entry: Pick<ActivityEntry, "contentTypeId" | "pluginId" | "target">,
    ): string => {
      if (entry.target.label) return entry.target.label;
      const noun =
        entry.contentTypeId && entry.target.type === entry.contentTypeId
          ? contentNoun(entry.pluginId, entry.contentTypeId)
          : humanizeFieldName(entry.target.type);

      return entry.target.id ? `${noun} #${entry.target.id}` : noun;
    };

    return { action, area, field, plugin, target };
  }, [t, tAll, titles]);
};

const AREA_VARIANTS = {
  admin: "default",
  moderator: "warning",
  public: "secondary",
  system: "outline",
} as const satisfies Record<AuditArea, string>;

export const ActivityAreaBadge = ({ area }: { area: AuditArea }) => {
  const t = useTranslations("core.activity_logs.areas");

  return (
    <Badge className="shrink-0" variant={AREA_VARIANTS[area]}>
      {t(area)}
    </Badge>
  );
};

/**
 * The actor of an entry: the account as it is today, linked to its AdminCP
 * page for an admin; the name the entry was written under once the account is
 * gone; "System" for background work.
 */
export const ActivityActor = ({
  className,
  entry,
  linkToAdmin = false,
}: {
  className?: string;
  entry: Pick<ActivityEntry, "actor" | "actorName" | "actorType">;
  linkToAdmin?: boolean;
}) => {
  const t = useTranslations("core.activity_logs");

  if (entry.actorType === "system") {
    return (
      <span className={cn("text-muted-foreground truncate", className)}>
        {t("system_actor")}
      </span>
    );
  }

  if (!entry.actor) {
    return (
      <span className={cn("text-muted-foreground truncate", className)}>
        {entry.actorName
          ? t("deleted_actor", { name: entry.actorName })
          : t("system_actor")}
      </span>
    );
  }

  const name = (
    <UserFormat
      format
      user={{
        name: entry.actor.name,
        role: { color: entry.actor.roleColor, prefix: entry.actor.rolePrefix },
      }}
    />
  );

  if (!linkToAdmin) {
    return <span className={cn("truncate", className)}>{name}</span>;
  }

  return (
    <Link
      className={cn(
        "hover:text-foreground focus-visible:ring-ring/50 truncate rounded-sm underline-offset-3 outline-none hover:underline focus-visible:ring-3",
        className,
      )}
      to={`/admin/core/users/${entry.actor.id}`}
    >
      {name}
    </Link>
  );
};
