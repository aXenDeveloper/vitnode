import type React from "react";

import type {
  DevErrorHint,
  DevErrorWithHints,
} from "../framework/dev-error/hints";

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

export class NavigationConfigError extends Error implements DevErrorWithHints {
  constructor(message: string, hints: readonly DevErrorHint[]) {
    super(`[VitNode navigation] ${message}`);
    this.name = "NavigationConfigError";
    this.hints = hints;
  }

  readonly hints: readonly DevErrorHint[];
}

const HREF_HINTS: DevErrorHint[] = [
  {
    description:
      'Start an href with "/" for a page on this site or "https://" for another site.',
    snippet: "{ href: '/docs', title: 'site.menu.docs' }",
    title: "Use a local or https link",
  },
];

const MESSAGE_KEY_HINTS: DevErrorHint[] = [
  {
    description:
      'Titles and descriptions are i18n keys such as "site.menu.docs", never text or objects.',
    snippet: "{ href: '/docs',\n  title: 'site.menu.docs' }",
    title: "Use a message key",
  },
  {
    description:
      "TypeScript flags a navigation item with the wrong shape before the app starts.",
    snippet: "pnpm tsc --noEmit",
    title: "Run the type check",
  },
];

const BOTTOM_BAR_HINTS: DevErrorHint[] = [
  {
    description: `The bottom bar fits ${String(NAVIGATION_BOTTOM_BAR_MAX_ITEMS)} links. Move the rest to navigation.header, where they open from the menu.`,
    snippet:
      "navigation: {\n  header: [/* the extra links */],\n  mobileBottomBar: [/* up to 3 */],\n}",
    title: "Move extra links to the header",
  },
];

const NAMESPACE_HINTS: DevErrorHint[] = [
  {
    description:
      "Put every menu key under one namespace, then add the keys to that namespace's locale file.",
    snippet: "title: 'site.menu.docs'\ntitle: 'site.menu.plugins'",
    title: "Share one namespace",
  },
];

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
      HREF_HINTS,
    );
  }

  for (const key of messageKeysOf(link)) {
    if (navigationMessageNamespace(key) === null) {
      throw new NavigationConfigError(
        `The ${where} item "${link.href}" has the title or description ${JSON.stringify(key)}. Both are message keys: a namespace and a name joined by ".", such as "site.menu.docs".`,
        MESSAGE_KEY_HINTS,
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
      BOTTOM_BAR_HINTS,
    );
  }

  for (const item of bottomBar) assertNavigationLink(item, "bottom bar");

  const namespaces = navigationMessageNamespaces(navigation);
  if (namespaces.length > MAX_NAMESPACES) {
    throw new NavigationConfigError(
      `The menus read ${String(namespaces.length)} message namespaces, and at most ${String(MAX_NAMESPACES)} load at once. Keep the menu's keys under one namespace, such as "site.menu".`,
      NAMESPACE_HINTS,
    );
  }
};
