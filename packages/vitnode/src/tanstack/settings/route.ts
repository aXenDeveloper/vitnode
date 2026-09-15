import type { SettingsNavKey } from "@/views/auth/settings/settings-nav";

export const SETTINGS_NAMESPACES = [
  "core.auth.settings",
  "core.global",
  "core.profile.images",
] as const;

export type { SettingsNavKey };
