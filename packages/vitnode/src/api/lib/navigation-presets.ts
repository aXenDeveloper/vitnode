import type {
  NavigationPreset,
  NavigationPresetDeclaration,
} from "@/lib/navigation";

import { isLucideIconName, serializeEmojiIcon } from "@/lib/emoji-icon";
import {
  isValidNavigationHref,
  NAVIGATION_PRESET_ID_MAX_LENGTH,
  NAVIGATION_PRESET_ID_PATTERN,
} from "@/lib/navigation";

export class NavigationPresetError extends Error {
  constructor(message: string) {
    super(`[VitNode navigation] ${message}`);
    this.name = "NavigationPresetError";
  }
}

export interface NavigationPresetSource {
  navigation?: readonly NavigationPresetDeclaration[];
  pluginId: string;
}

const assertPresetId = (pluginId: string, id: unknown): string => {
  if (typeof id !== "string" || id.length === 0) {
    throw new NavigationPresetError(
      `Plugin "${pluginId}" declares a navigation preset without an id.`,
    );
  }

  if (
    id.length > NAVIGATION_PRESET_ID_MAX_LENGTH ||
    !NAVIGATION_PRESET_ID_PATTERN.test(id)
  ) {
    throw new NavigationPresetError(
      `Plugin "${pluginId}" declares the navigation preset "${id}". A preset id is lowercase letters, digits, "-" and "_", starts with a letter or digit, and is at most ${String(NAVIGATION_PRESET_ID_MAX_LENGTH)} characters.`,
    );
  }

  return id;
};

const assertPresetHref = (pluginId: string, id: string, href: unknown) => {
  if (typeof href !== "string" || !isValidNavigationHref(href)) {
    throw new NavigationPresetError(
      `Navigation preset "${id}" of "${pluginId}" needs an href that starts with "/" or "https://".`,
    );
  }

  return href;
};

const assertPresetIcon = (
  pluginId: string,
  id: string,
  icon: unknown,
): null | string => {
  if (icon === undefined) return null;

  if (typeof icon !== "string" || !isLucideIconName(icon)) {
    throw new NavigationPresetError(
      `Navigation preset "${id}" of "${pluginId}" names the icon ${JSON.stringify(icon)}. An icon is a lucide name such as "compass".`,
    );
  }

  // Stored the way every other icon in VitNode is - the same `icon:name` string
  // a role prefix holds - so one picker writes it and one component draws it.
  return serializeEmojiIcon({ type: "icon", value: icon });
};

export const collectNavigationPresets = (
  plugins: readonly NavigationPresetSource[],
): NavigationPreset[] => {
  const seen = new Set<string>();
  const presets: NavigationPreset[] = [];

  for (const plugin of plugins) {
    for (const declaration of plugin.navigation ?? []) {
      const id = assertPresetId(plugin.pluginId, declaration.id);
      const key = `${plugin.pluginId}:${id}`;

      if (seen.has(key)) {
        throw new NavigationPresetError(
          `Plugin "${plugin.pluginId}" declares the navigation preset "${id}" twice.`,
        );
      }
      seen.add(key);

      presets.push({
        href: assertPresetHref(plugin.pluginId, id, declaration.href),
        icon: assertPresetIcon(plugin.pluginId, id, declaration.icon),
        id,
        isOpenInNewTab: declaration.isOpenInNewTab ?? false,
        pluginId: plugin.pluginId,
      });
    }
  }

  return presets;
};

export const findNavigationPreset = (
  presets: readonly NavigationPreset[],
  pluginId: string,
  presetId: string,
): NavigationPreset | undefined =>
  presets.find(
    preset => preset.pluginId === pluginId && preset.id === presetId,
  );
