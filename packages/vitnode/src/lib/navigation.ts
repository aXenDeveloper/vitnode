import type React from "react";

import {
  MAX_NAMESPACES,
  namespaceProblem,
  normalizeNamespaceList,
} from "../routing/namespaces";

export const NAVIGATION_BOTTOM_BAR_MAX_ITEMS = 3;

export const NAVIGATION_HREF_MAX_LENGTH = 2048;

export type NavigationIcon = React.ComponentType<{ className?: string }>;

export interface NavigationLinkConfig {
  description?: string;
  href: string;
  icon?: NavigationIcon;
  isOpenInNewTab?: boolean;
  title: string;
}

export interface NavigationHeaderItemConfig extends NavigationLinkConfig {
  items?: NavigationLinkConfig[];
}

export interface NavigationConfig {
  header?: NavigationHeaderItemConfig[];
  mobileBottomBar?: NavigationLinkConfig[];
}

export class NavigationConfigError extends Error {
  constructor(message: string) {
    super(`[VitNode navigation] ${message}`);
    this.name = "NavigationConfigError";
  }
}

export const isExternalNavigationHref = (href: string): boolean =>
  href.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(href);

export const isValidNavigationHref = (href: string): boolean => {
  const trimmed = href.trim();
  if (trimmed !== href || trimmed.length === 0) return false;
  if (trimmed.length > NAVIGATION_HREF_MAX_LENGTH) return false;
  if (/\s/.test(trimmed)) return false;

  if (trimmed.startsWith("/")) return !trimmed.startsWith("//");

  return /^https:\/\/[^/?#]+/i.test(trimmed);
};

export const navigationMessageNamespace = (key: unknown): null | string => {
  if (typeof key !== "string") return null;

  const separatorAt = key.lastIndexOf(".");
  if (separatorAt <= 0 || separatorAt === key.length - 1) return null;

  const namespace = key.slice(0, separatorAt);

  return namespaceProblem(namespace) === null ? namespace : null;
};

const messageKeysOf = (link: NavigationLinkConfig): string[] => [
  link.title,
  ...(link.description === undefined ? [] : [link.description]),
];

const navigationLinksOf = (
  navigation: NavigationConfig | undefined,
): NavigationLinkConfig[] => [
  ...(navigation?.header ?? []).flatMap(item => [item, ...(item.items ?? [])]),
  ...(navigation?.mobileBottomBar ?? []),
];

export const navigationMessageNamespaces = (
  navigation: NavigationConfig | undefined,
): string[] =>
  normalizeNamespaceList(
    navigationLinksOf(navigation)
      .flatMap(messageKeysOf)
      .flatMap(key => navigationMessageNamespace(key) ?? []),
  );

const assertNavigationLink = (
  link: NavigationLinkConfig,
  where: string,
): void => {
  if (!isValidNavigationHref(link.href)) {
    throw new NavigationConfigError(
      `The ${where} item ${JSON.stringify(link.href)} needs an href that starts with "/" or "https://".`,
    );
  }

  for (const key of messageKeysOf(link)) {
    if (navigationMessageNamespace(key) === null) {
      throw new NavigationConfigError(
        `The ${where} item "${link.href}" has the title or description ${JSON.stringify(key)}. Both are message keys: a namespace and a name joined by ".", such as "site.menu.docs".`,
      );
    }
  }
};

export const assertNavigationConfig = (
  navigation: NavigationConfig | undefined,
): void => {
  for (const item of navigation?.header ?? []) {
    assertNavigationLink(item, "header");

    for (const child of item.items ?? []) {
      assertNavigationLink(child, "header dropdown");
    }
  }

  const bottomBar = navigation?.mobileBottomBar ?? [];
  if (bottomBar.length > NAVIGATION_BOTTOM_BAR_MAX_ITEMS) {
    throw new NavigationConfigError(
      `The mobile bottom bar holds up to ${String(NAVIGATION_BOTTOM_BAR_MAX_ITEMS)} links, and ${String(bottomBar.length)} are configured.`,
    );
  }

  for (const item of bottomBar) assertNavigationLink(item, "bottom bar");

  const namespaces = navigationMessageNamespaces(navigation);
  if (namespaces.length > MAX_NAMESPACES) {
    throw new NavigationConfigError(
      `The menus read ${String(namespaces.length)} message namespaces, and at most ${String(MAX_NAMESPACES)} load at once. Keep the menu's keys under one namespace, such as "site.menu".`,
    );
  }
};
