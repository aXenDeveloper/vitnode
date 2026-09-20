import React from "react";
import { useLocale, useTranslations } from "use-intl";

import type {
  NavigationLabelSource,
  NavigationTranslate,
} from "@/lib/navigation";

import { navigationItemLabels } from "@/lib/navigation";

interface RootTranslator {
  (key: string): string;
  has: (key: string) => boolean;
}

export const useNavigationTranslate = (): NavigationTranslate => {
  const t = useTranslations() as unknown as RootTranslator;

  return React.useCallback(
    (namespace, key) => {
      const path = `${namespace}.${key}`;

      return t.has(path) ? t(path) : undefined;
    },
    [t],
  );
};

export const useNavigationItemLabels = (
  item: NavigationLabelSource,
): { description: string; title: string } => {
  const locale = useLocale();
  const translate = useNavigationTranslate();

  return navigationItemLabels({ item, locale, translate });
};

export const presetLabelSource = (preset: {
  id: string;
  pluginId: string;
}): NavigationLabelSource => ({
  description: [],
  kind: "preset",
  pluginId: preset.pluginId,
  presetId: preset.id,
  title: [],
});
