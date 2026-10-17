import type { AdminComponentUpdate } from "./plugin-updates-query";

export const PLUGIN_TONES = [
  "security",
  "error",
  "update",
  "unknown",
  "pending",
  "ok",
  "off",
  "disabled",
] as const;

export type PluginTone = (typeof PLUGIN_TONES)[number];

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
