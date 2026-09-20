import { CONFIG_PLUGIN } from "@/config";

export const NAVIGATION_KINDS = ["preset", "custom"] as const;
export type NavigationKind = (typeof NAVIGATION_KINDS)[number];

export const NAVIGATION_TABLE_NAME = "core_navigation";

export const NAVIGATION_WORDS = {
  description: "description",
  title: "title",
} as const;

export const NAVIGATION_TITLE_MAX_LENGTH = 100;
export const NAVIGATION_DESCRIPTION_MAX_LENGTH = 255;
export const NAVIGATION_HREF_MAX_LENGTH = 2048;
export const NAVIGATION_PRESET_ID_MAX_LENGTH = 120;
export const NAVIGATION_PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
export const NAVIGATION_MAX_DEPTH = 1;

export interface NavigationPresetDeclaration {
  href: string;
  icon?: string;
  id: string;
  isOpenInNewTab?: boolean;
}

export interface NavigationPreset extends Omit<
  NavigationPresetDeclaration,
  "icon" | "isOpenInNewTab"
> {
  icon: null | string;
  isOpenInNewTab: boolean;
  pluginId: string;
}

export interface NavigationText {
  languageCode: string;
  value: string;
}

export interface PublicNavigationItem {
  description: NavigationText[];
  href: string;
  icon: null | string;
  id: number;
  isOpenInNewTab: boolean;
  kind: NavigationKind;
  pluginId: null | string;
  presetId: null | string;
  title: NavigationText[];
}

export interface PublicNavigationNode extends PublicNavigationItem {
  items: PublicNavigationItem[];
}

const CORE_NAVIGATION_NAMESPACE = "core.navigation";

export const navigationMessagesNamespace = (pluginId: string): string =>
  pluginId === CONFIG_PLUGIN.pluginId
    ? CORE_NAVIGATION_NAMESPACE
    : `${pluginId}.navigation`;

export const navigationPresetMessageKeys = (presetId: string) => ({
  description: `${presetId}.description`,
  title: `${presetId}.title`,
});

const PRESET_KEY_SEPARATOR = "::";

export const navigationPresetKey = (
  pluginId: string,
  presetId: string,
): string => `${pluginId}${PRESET_KEY_SEPARATOR}${presetId}`;

export const parseNavigationPresetKey = (
  key: string,
): null | { pluginId: string; presetId: string } => {
  const separatorAt = key.lastIndexOf(PRESET_KEY_SEPARATOR);
  if (separatorAt <= 0) return null;

  const pluginId = key.slice(0, separatorAt);
  const presetId = key.slice(separatorAt + PRESET_KEY_SEPARATOR.length);
  if (!pluginId || !presetId) return null;

  return { pluginId, presetId };
};

export const isExternalNavigationHref = (href: string): boolean =>
  href.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(href);

export const isValidNavigationHref = (href: string): boolean => {
  const trimmed = href.trim();
  if (trimmed !== href || trimmed.length === 0) return false;
  if (trimmed.length > NAVIGATION_HREF_MAX_LENGTH) return false;
  if (/\s/.test(trimmed)) return false;

  if (trimmed.startsWith("/")) return !trimmed.startsWith("//");

  // https only: a menu item is a link the whole site hands out, and sending
  // readers to a plaintext address is not something an admin should be able to
  // do by typing one character less.
  return /^https:\/\/[^/?#]+/i.test(trimmed);
};

const firstNonEmpty = (values: readonly NavigationText[]): string =>
  values.find(item => item.value.trim().length > 0)?.value.trim() ?? "";

export const resolveNavigationText = ({
  fallback,
  locale,
  values,
}: {
  fallback?: string;
  locale: string;
  values: readonly NavigationText[];
}): string => {
  const own = values.find(item => item.languageCode === locale)?.value.trim();
  if (own) return own;

  const preset = fallback?.trim();
  if (preset) return preset;

  return firstNonEmpty(values);
};

export type NavigationTranslate = (
  namespace: string,
  key: string,
) => string | undefined;

export interface NavigationLabelSource {
  description: readonly NavigationText[];
  kind: NavigationKind;
  pluginId: null | string;
  presetId: null | string;
  title: readonly NavigationText[];
}

const presetDefaults = (
  item: Pick<NavigationLabelSource, "kind" | "pluginId" | "presetId">,
  translate: NavigationTranslate,
): { description?: string; title?: string } => {
  if (item.kind !== "preset" || !item.pluginId || !item.presetId) return {};

  const namespace = navigationMessagesNamespace(item.pluginId);
  const keys = navigationPresetMessageKeys(item.presetId);

  return {
    description: translate(namespace, keys.description),
    title: translate(namespace, keys.title),
  };
};

export const navigationItemLabels = ({
  item,
  locale,
  translate,
}: {
  item: NavigationLabelSource;
  locale: string;
  translate: NavigationTranslate;
}): { description: string; title: string } => {
  const defaults = presetDefaults(item, translate);

  return {
    description: resolveNavigationText({
      fallback: defaults.description,
      locale,
      values: item.description,
    }),
    title: resolveNavigationText({
      fallback: defaults.title,
      locale,
      values: item.title,
    }),
  };
};

interface NavigationNamespaceSource {
  items?: readonly NavigationNamespaceSource[];
  kind: NavigationKind;
  pluginId: null | string;
}

const namespacesOf = (item: NavigationNamespaceSource): string[] => [
  ...(item.kind === "preset" && item.pluginId
    ? [navigationMessagesNamespace(item.pluginId)]
    : []),
  ...(item.items ?? []).flatMap(namespacesOf),
];

export const navigationNamespaces = (
  items: readonly NavigationNamespaceSource[],
): string[] =>
  [...new Set(items.flatMap(namespacesOf))].sort((a, b) => a.localeCompare(b));
