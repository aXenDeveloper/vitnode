import type {
  AutoTranslateResponse,
  AutoTranslateSettings,
} from "@vitnode/api/content/auto-translate";

import { queryOptions } from "@tanstack/react-query";
import { AUTO_TRANSLATE_MAX_ITEMS } from "@vitnode/api/content/auto-translate";

import { fetcher } from "@/tanstack/fetcher";

export const AUTO_TRANSLATE_QUERY_ROOT = [
  "@vitnode/core",
  "auto-translate",
] as const;

/** One record and the fields a page renders of it. */
export interface AutoTranslateItemRequest {
  contentTypeId: string;
  fields: { fingerprint: string; name: string }[];
  id: number | string;
}

export const AUTO_TRANSLATE_DISABLED: AutoTranslateSettings = {
  auto: false,
  canGenerate: false,
  enabled: false,
  locales: [],
};

export const chunkAutoTranslateItems = (
  items: AutoTranslateItemRequest[],
): AutoTranslateItemRequest[][] =>
  Array.from(
    { length: Math.ceil(items.length / AUTO_TRANSLATE_MAX_ITEMS) },
    (_, index) =>
      items.slice(
        index * AUTO_TRANSLATE_MAX_ITEMS,
        (index + 1) * AUTO_TRANSLATE_MAX_ITEMS,
      ),
  );

/**
 * The site switch and this reader's choice. Keyed by viewer, so a sign-in or
 * sign-out never reuses another reader's answer. A failed read counts as off.
 */
export const autoTranslateSettingsQueryOptions = (viewerId: null | number) =>
  queryOptions({
    queryFn: async ({ signal }): Promise<AutoTranslateSettings> => {
      const res = await fetcher({
        plugin: "@vitnode/core",
        method: "get",
        module: "content",
        path: "/translations/settings",
        options: { signal },
      });
      if (!res.ok) return AUTO_TRANSLATE_DISABLED;

      return await res.json();
    },
    queryKey: [...AUTO_TRANSLATE_QUERY_ROOT, "settings", viewerId] as const,
    staleTime: 5 * 60_000,
  });

/** Saved translations and states, read-only. Universal: works in a loader and in the browser. */
export const lookupAutoTranslations = async ({
  items,
  locale,
  signal,
}: {
  items: AutoTranslateItemRequest[];
  locale: string;
  signal?: AbortSignal;
}): Promise<AutoTranslateResponse | null> => {
  if (items.length === 0) return { items: [], locale };
  const res = await fetcher({
    plugin: "@vitnode/core",
    method: "post",
    module: "content",
    path: "/translations/lookup",
    args: { body: { items, locale } },
    options: { signal },
  });

  return res.ok ? await res.json() : null;
};

/** Saved translations, and new ones queued for a signed-in reader. */
export const requestAutoTranslations = async ({
  items,
  locale,
  mode,
  signal,
}: {
  items: AutoTranslateItemRequest[];
  locale: string;
  mode: "automatic" | "manual";
  signal?: AbortSignal;
}): Promise<AutoTranslateResponse | null> => {
  const res = await fetcher({
    plugin: "@vitnode/core",
    method: "post",
    module: "content",
    path: "/translations/request",
    args: { body: { items, locale, mode } },
    options: { signal },
  });

  return res.ok ? await res.json() : null;
};

/** Saves the reader's choice: on the account when signed in, in a cookie for guests. */
export const saveAutoTranslatePreference = async (
  auto: boolean,
): Promise<boolean> => {
  const res = await fetcher({
    plugin: "@vitnode/core",
    method: "put",
    module: "content",
    path: "/translations/preference",
    args: { body: { auto } },
  });

  return res.ok;
};
