import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import {
  MAX_NAMESPACE_DEPTH,
  MAX_NAMESPACE_LENGTH,
  MAX_NAMESPACES,
  namespaceProblem,
} from "@/routing";

import { getIntlRuntime } from "./runtime";

/**
 * Re-exported rather than declared: what makes a namespace legal is now
 * `@vitnode/core/routing`'s, because a plugin *declares* namespaces in its route
 * manifest at build time and a browser *asks* for them at runtime, and two
 * copies of that rule is how the manifest ends up accepting something the server
 * refuses. The names stay here so nothing that imports them has to move.
 */
export { MAX_NAMESPACE_DEPTH, MAX_NAMESPACE_LENGTH, MAX_NAMESPACES };

/** The strings every page needs, whatever else it renders. */
export const GLOBAL_NAMESPACE = "core.global";

/** Everything a message entry's key starts with, before the language. */
const INTL_QUERY_SCOPE = ["vitnode", "intl"] as const;

/**
 * One language's slice of the message cache.
 *
 * Its own function because two things need it: the key each entry is stored
 * under, and the prefix `loadedIntlNamespaces` searches by. Spelling the prefix
 * out twice would let a search silently stop matching the keys it is looking
 * for.
 */
const intlQueryPrefix = (locale: string) => [...INTL_QUERY_SCOPE, locale];

/**
 * Namespaces in a form two callers cannot spell differently.
 *
 * Sorted and de-duplicated, because the list is part of the query key: without
 * this, `["core.global", "core.discover"]` and `["core.discover", "core.global"]`
 * are two cache entries holding the same bytes, fetched twice and invalidated
 * separately.
 *
 * Normalisation only - it assumes strings, and says nothing about whether they
 * are acceptable. That is {@link assertNamespace}'s job, and it runs on the
 * server where the input is untrusted.
 */
const normalizeNamespaces = (namespaces: readonly string[]): string[] =>
  [...new Set(namespaces)].sort((a, b) => a.localeCompare(b));

/**
 * One namespace, or an error.
 *
 * The rule is `namespaceProblem`'s, in the routing layer, and all this adds is
 * the subject of the sentence - `namespaces[0] must be a string.` - so a message
 * a build shows about a plugin's manifest and a message this server function
 * logs about a request say the same thing about the same value.
 *
 * Deliberately says *what* was wrong and not *what was sent*: the value is
 * attacker-controlled and this message ends up in a server log.
 */
const assertNamespace = (value: unknown, index: number): string => {
  const problem = namespaceProblem(value);

  if (problem) throw new Error(`namespaces[${index}] ${problem}`);

  return value as string;
};

/**
 * What the host's server function will accept.
 *
 * Everything below treats the argument as arriving from the network, because
 * once an app is built that is exactly what it does: a server function is a
 * public `POST` endpoint, and nothing about the client that normally calls it is
 * enforceable.
 *
 * The locale is the one field that degrades rather than fails. A stale link to a
 * language that has since been removed should still render the page in the
 * default language; being strict there would turn a config change into a 500 on
 * every old URL. A namespace, by contrast, is only ever sent by an app's own
 * code, so anything unexpected is rejected outright - filtering it away silently
 * would hide the fact that something is sending it.
 *
 * Passed to `createServerFn().validator(...)` by the host, which is the only
 * place a server function may be declared. Exported rather than inlined there
 * because a server function cannot be invoked outside a request scope, so
 * calling this directly is the only way to exercise the boundary.
 */
export const validateIntlInput = (input: unknown) => {
  const { localeRouting } = getIntlRuntime();

  if (typeof input !== "object" || input === null) {
    throw new Error("Expected an object.");
  }

  const { locale, namespaces } = input as {
    locale?: unknown;
    namespaces?: unknown;
  };

  if (typeof locale !== "string") throw new Error("locale must be a string.");
  if (!Array.isArray(namespaces)) {
    throw new Error("namespaces must be an array.");
  }
  // Checked before validating each entry, so a caller cannot make the server
  // walk an arbitrarily long list just to be told the list was too long.
  if (namespaces.length > MAX_NAMESPACES) {
    throw new Error(`At most ${MAX_NAMESPACES} namespaces may be requested.`);
  }

  return {
    locale: localeRouting.isSupportedLocale(locale)
      ? locale
      : localeRouting.defaultLocale,
    // `Array.from` rather than `map`: `map` skips holes in a sparse array, so
    // an entry could reach normalisation without ever being validated. This
    // visits them as `undefined`, which `assertNamespace` rejects.
    namespaces: normalizeNamespaces(Array.from(namespaces, assertNamespace)),
  };
};

/**
 * One language's messages, as a query - and the only way an app should ask.
 *
 * The locale is a required argument and part of the key. That is the whole
 * point: two languages coexist in one QueryClient, a language switch changes the
 * key rather than the value under it, and nothing ever resolves "the current
 * locale" from inside a query function, where it would be whatever the last
 * render happened to leave behind.
 *
 * The fetch itself comes from the host, through `configureIntl` - see
 * {@link IntlMessagesFetcher} for why a package cannot declare it.
 *
 * `staleTime: Infinity` - a locale's messages change when the app is redeployed.
 */
export const intlQueryOptions = ({
  locale,
  namespaces = [GLOBAL_NAMESPACE],
}: {
  locale: string;
  namespaces?: readonly string[];
}) => {
  const normalized = normalizeNamespaces(namespaces);

  return queryOptions({
    queryFn: async () =>
      await getIntlRuntime().fetchMessages({
        locale,
        namespaces: normalized,
      }),
    queryKey: [...intlQueryPrefix(locale), ...normalized] as const,
    staleTime: Infinity,
  });
};

/**
 * Every namespace set a client currently holds messages for, in one language.
 *
 * Read off the cache rather than declared anywhere, and that is the point: the
 * root asks for `core.global`, a route asks for whatever it renders, and by the
 * time somebody switches language the cache is the only place that knows which
 * sets are on screen. A language switch has to warm *those* - warming only the
 * global set leaves the route's provider suspending on a key nobody fetched,
 * which blanks the page for a round trip.
 *
 * Falls back to the global set, so a switch made before anything has loaded
 * still warms the one set every page needs.
 */
export const loadedIntlNamespaces = (
  queryClient: QueryClient,
  locale: string,
): string[][] => {
  const prefix = intlQueryPrefix(locale);
  const sets = queryClient
    .getQueryCache()
    .findAll({ queryKey: prefix })
    .map(({ queryKey }) =>
      queryKey
        .slice(prefix.length)
        .filter((part): part is string => typeof part === "string"),
    )
    .filter(namespaces => namespaces.length > 0);

  return sets.length > 0 ? sets : [[GLOBAL_NAMESPACE]];
};
