import type { LucideIcon } from "lucide-react";

import {
  ArrowUpCircleIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  CircleOffIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";

import type { AdminComponentUpdate } from "./plugin-updates-query";

export type PluginTone =
  | "disabled"
  | "error"
  | "off"
  | "ok"
  | "pending"
  | "security"
  | "unknown"
  | "update";

export const PLUGIN_TONE_STYLE: Record<
  PluginTone,
  { className: string; icon: LucideIcon }
> = {
  security: {
    icon: ShieldAlertIcon,
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
  error: {
    icon: TriangleAlertIcon,
    className: "bg-warn/10 text-warn dark:bg-warn/20",
  },
  update: {
    icon: ArrowUpCircleIcon,
    className: "bg-primary/10 text-primary dark:bg-primary/20",
  },
  unknown: {
    icon: CircleHelpIcon,
    className: "bg-muted text-muted-foreground",
  },
  pending: {
    icon: CircleDashedIcon,
    className: "bg-muted text-muted-foreground",
  },
  ok: {
    icon: CircleCheckIcon,
    className: "bg-success/10 text-success dark:bg-success/20",
  },
  off: {
    icon: CircleOffIcon,
    className: "bg-muted text-muted-foreground",
  },
  disabled: {
    icon: CircleOffIcon,
    className: "bg-muted text-muted-foreground",
  },
};

export const pluginToneOf = (
  update: AdminComponentUpdate | undefined,
  enabled: boolean,
): null | PluginTone => {
  if (update === undefined) return null;
  if ((update.result?.securityUpdates.length ?? 0) > 0) return "security";
  if (!enabled) return "disabled";
  if (update.state === "unavailable") return "off";
  if (update.lastError !== null) return "error";
  if (update.result?.status === "update_available") return "update";
  if (update.state === "not_checked") return "pending";
  if (update.result?.status === "up_to_date") return "ok";

  return "unknown";
};
