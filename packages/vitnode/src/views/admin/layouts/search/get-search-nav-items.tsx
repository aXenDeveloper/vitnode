import { BugIcon } from "lucide-react";
import { createTranslator } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "server-only";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { VitNodeConfig } from "@/vitnode.config";

import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { loadMessages } from "@/lib/i18n/load-messages";
import { buildMessagesSources } from "@/lib/i18n/sources";

import type { AdminNavTranslator } from "../sidebar/nav/get-admin-nav";
import type { NavAdminParent } from "../sidebar/nav/get-admin-nav";
import type { AdminSearchNavItem } from "./flatten-nav";

import { normalizeUrl } from "../normalize-url";
import { getAdminNav } from "../sidebar/nav/get-admin-nav";
import { buildSearchText, flattenAdminNav } from "./flatten-nav";

interface SearchOnlyPage {
  href: string;
  icon: React.ReactNode;
  permission: Omit<PermissionsStaffArgs, "plugin">;
  titleKey: string;
}

const SEARCH_ONLY_PAGES: SearchOnlyPage[] = [
  {
    href: "/admin/core/debug",
    icon: <BugIcon />,
    permission: { module: "debug", permission: "can_view" },
    titleKey: "admin.global.nav.user_bar.debug",
  },
];

const getPermittedSearchOnlyPages = async (): Promise<SearchOnlyPage[]> => {
  const allowed = await Promise.all(
    SEARCH_ONLY_PAGES.map(
      async page => await checkAdminPermissionApi(page.permission),
    ),
  );

  return SEARCH_ONLY_PAGES.filter((_, index) => allowed[index]);
};

const toSearchItems = (
  pages: SearchOnlyPage[],
  t: AdminNavTranslator,
): AdminSearchNavItem[] =>
  pages.map(page => {
    const groupTitle = t("admin.global.nav.core");
    const title = t(page.titleKey);

    return {
      groupTitle,
      href: page.href,
      icon: page.icon,
      searchText: buildSearchText([title, groupTitle]),
      title,
    };
  });

const getEnabledLocales = (vitNodeConfig: VitNodeConfig): string[] =>
  vitNodeConfig.i18n.locales
    .filter(locale => locale.enabled !== false)
    .map(locale => locale.code);

const getItemsForLocale = async ({
  locale,
  searchOnlyPages,
  vitNodeConfig,
}: {
  locale: string;
  searchOnlyPages: SearchOnlyPage[];
  vitNodeConfig: VitNodeConfig;
}): Promise<AdminSearchNavItem[]> => {
  const messages = await loadMessages({
    defaultLocale: vitNodeConfig.i18n.defaultLocale,
    locale,
    sources: buildMessagesSources({
      appMessages: vitNodeConfig.i18n.messages,
      plugins: vitNodeConfig.plugins,
    }),
  });
  const translator = createTranslator({
    locale,
    messages,
  }) as unknown as AdminNavTranslator;

  return [
    ...flattenAdminNav(await getAdminNav({ translator, vitNodeConfig })),
    ...toSearchItems(searchOnlyPages, translator),
  ];
};

export const getSearchNavItems = async ({
  nav,
  vitNodeConfig,
}: {
  nav: NavAdminParent[];
  vitNodeConfig: VitNodeConfig;
}): Promise<AdminSearchNavItem[]> => {
  const searchOnlyPages = await getPermittedSearchOnlyPages();
  const activeTranslator =
    (await getTranslations()) as unknown as AdminNavTranslator;
  const items = [
    ...flattenAdminNav(nav),
    ...toSearchItems(searchOnlyPages, activeTranslator),
  ];
  const activeLocale = await getLocale();
  const otherLocales = getEnabledLocales(vitNodeConfig).filter(
    locale => locale !== activeLocale,
  );

  if (!otherLocales.length) return items;

  const translated = await Promise.all(
    otherLocales.map(
      async locale =>
        await getItemsForLocale({ locale, searchOnlyPages, vitNodeConfig }),
    ),
  );

  const textByHref = new Map<string, string[]>();
  for (const list of [items, ...translated]) {
    for (const item of list) {
      const key = normalizeUrl(item.href);
      textByHref.set(key, [
        ...(textByHref.get(key) ?? []),
        item.title,
        item.parentTitle ?? "",
        item.groupTitle,
      ]);
    }
  }

  return items.map(item => ({
    ...item,
    searchText: buildSearchText(textByHref.get(normalizeUrl(item.href)) ?? []),
  }));
};
