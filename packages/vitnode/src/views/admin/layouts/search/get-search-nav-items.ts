import { createTranslator } from "next-intl";
import { getLocale } from "next-intl/server";
import "server-only";

import type { VitNodeConfig } from "@/vitnode.config";

import { loadMessages } from "@/lib/i18n/load-messages";
import { buildMessagesSources } from "@/lib/i18n/sources";

import type { NavAdminParent } from "../sidebar/nav/get-admin-nav";
import type { AdminNavTranslator } from "../sidebar/nav/get-admin-nav";
import type { AdminSearchNavItem } from "./flatten-nav";

import { normalizeUrl } from "../normalize-url";
import { getAdminNav } from "../sidebar/nav/get-admin-nav";
import { buildSearchText, flattenAdminNav } from "./flatten-nav";

const getEnabledLocales = (vitNodeConfig: VitNodeConfig): string[] =>
  vitNodeConfig.i18n.locales
    .filter(locale => locale.enabled !== false)
    .map(locale => locale.code);

const getNavForLocale = async ({
  locale,
  vitNodeConfig,
}: {
  locale: string;
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

  return flattenAdminNav(
    await getAdminNav({
      translator: createTranslator({
        locale,
        messages,
      }) as unknown as AdminNavTranslator,
      vitNodeConfig,
    }),
  );
};

export const getSearchNavItems = async ({
  nav,
  vitNodeConfig,
}: {
  nav: NavAdminParent[];
  vitNodeConfig: VitNodeConfig;
}): Promise<AdminSearchNavItem[]> => {
  const items = flattenAdminNav(nav);
  const activeLocale = await getLocale();
  const otherLocales = getEnabledLocales(vitNodeConfig).filter(
    locale => locale !== activeLocale,
  );

  if (!otherLocales.length) return items;

  const translated = await Promise.all(
    otherLocales.map(
      async locale => await getNavForLocale({ locale, vitNodeConfig }),
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
