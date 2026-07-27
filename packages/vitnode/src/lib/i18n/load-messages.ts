/* eslint-disable no-console */
import type { Messages, MessagesSource } from "./types";

import { deepMerge } from "./deep-merge";

const messagesCache = new Map<string, Promise<Messages>>();
const warned = new Set<string>();

const cacheEnabled = (): boolean => process.env.NODE_ENV === "production";

const warnOnce = (key: string, message: string) => {
  if (warned.has(key)) return;
  warned.add(key);

  console.warn(`\x1b[34m[VitNode i18n]\x1b[0m \x1b[33m${message}\x1b[0m`);
};

const loadSourceMessages = async (
  source: MessagesSource,
  locale: string,
  isDefaultLocale: boolean,
): Promise<Messages | null> => {
  const loader = source.messages?.[locale];
  // A source's id repeats across scopes (web vs api), so warnings key off both,
  // or one scope's warning would silence the other's.
  const warnId = `${source.scope ?? ""}:${source.id}`;

  if (!loader) {
    // Not translating into every language is normal - the default locale fills
    // the gaps. Shipping no messages for the *default* locale is always a bug,
    // so that one is worth a word.
    if (isDefaultLocale && !source.optional && source.messages) {
      warnOnce(
        `${warnId}:${locale}:missing`,
        `"${source.id}" ships no messages for the default locale "${locale}".`,
      );
    }

    return null;
  }

  try {
    const loaded = await loader();

    if (!loaded.default) {
      warnOnce(
        `${warnId}:${locale}:empty`,
        `"${source.id}" exports no default from its "${locale}" messages.`,
      );

      return null;
    }

    return loaded.default;
  } catch (error) {
    warnOnce(
      `${warnId}:${locale}:failed`,
      `Could not load "${locale}" messages for "${source.id}" - its strings will render as raw keys. ${String(error)}`,
    );

    return null;
  }
};

const mergeLocale = async (
  sources: MessagesSource[],
  locale: string,
  isDefaultLocale: boolean,
): Promise<{ found: number; messages: Messages }> => {
  const parts = await Promise.all(
    sources.map(async source =>
      loadSourceMessages(source, locale, isDefaultLocale),
    ),
  );

  return parts.reduce<{ found: number; messages: Messages }>(
    (acc, part) =>
      part
        ? { found: acc.found + 1, messages: deepMerge(acc.messages, part) }
        : acc,
    { found: 0, messages: {} },
  );
};

const buildMessages = async ({
  defaultLocale,
  locale,
  sources,
}: {
  defaultLocale: string;
  locale: string;
  sources: MessagesSource[];
}): Promise<Messages> => {
  const base = await mergeLocale(sources, defaultLocale, true);
  if (locale === defaultLocale) return base.messages;

  const requested = await mergeLocale(sources, locale, false);

  if (requested.found === 0) {
    warnOnce(
      `*:${locale}:unknown`,
      `Nothing provides "${locale}" messages - falling back to "${defaultLocale}".`,
    );

    return base.messages;
  }

  // The default locale sits underneath so a partial translation degrades key by
  // key instead of leaking `some.translation.key` into the UI.
  return deepMerge(base.messages, requested.messages);
};

/**
 * Merges every source's messages for `locale` into one tree, with the default
 * locale underneath as a per-key fallback.
 *
 * Sources are applied in order - core, then each plugin, then app overrides -
 * so later ones win. The result is memoised per locale in production (emails and
 * pages hit the cache instead of re-reading every locale file); in development
 * the cache is off so edits to a locale file show up on the next request.
 */
export const loadMessages = async ({
  defaultLocale,
  locale,
  sources,
}: {
  defaultLocale: string;
  locale: string;
  sources: MessagesSource[];
}): Promise<Messages> => {
  if (!cacheEnabled()) {
    return await buildMessages({ defaultLocale, locale, sources });
  }

  // Scope is part of the key: web and api source-sets share plugin ids but ship
  // different trees, so a single app (both in one process) must not serve one
  // where it asked for the other.
  const cacheKey = `${defaultLocale}|${locale}|${sources
    .map(source => `${source.scope ?? ""}#${source.id}`)
    .join(",")}`;
  const cached = messagesCache.get(cacheKey);
  if (cached) return await cached;

  const messages = buildMessages({ defaultLocale, locale, sources });
  messagesCache.set(cacheKey, messages);

  return await messages;
};

/** Every locale code at least one source ships, sorted. */
export const collectLocaleCodes = (sources: MessagesSource[]): string[] =>
  [
    ...new Set(sources.flatMap(source => Object.keys(source.messages ?? {}))),
  ].sort((a, b) => a.localeCompare(b));

/** Drops the memoised trees. Exported for tests. */
export const resetMessagesCache = () => {
  messagesCache.clear();
  warned.clear();
};
