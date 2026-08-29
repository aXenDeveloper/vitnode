import type { QueryClient } from "@tanstack/react-query";

import { normalizeNamespaceList } from "@/routing";

import { intlQueryOptions } from "../i18n/query";

/**
 * Which strings the AdminCP loads, and when.
 *
 * There is no admin locale here, and that is the point: `/admin` resolves its
 * language through exactly the same path every other route does.
 * `DEFAULT_IGNORED_LOCALE_PATHS` in `lib/i18n/locale-routing.ts` lists `/admin`
 * with its descendants, so:
 *
 * - `rewrite.input` never strips a prefix from an admin URL and `rewrite.output`
 *   never writes one, which is why `<Link to="/admin/core/users">` renders
 *   `/admin/core/users` in every language.
 * - `handleLocaleRequest` 308-redirects `/pl/admin/...` to `/admin/...` **and
 *   attaches the locale cookie to the redirect**, so arriving by a prefixed
 *   admin URL still records the choice before the redirect ends the request.
 * - `resolveLocale` on an ignored path falls through to the locale cookie and
 *   then to the default. That *is* the AdminCP's language, and there is no other
 *   source.
 *
 * So `__root`'s `beforeLoad` has already put the answer in `context.locale` by
 * the time anything below runs. There is deliberately no `AdminLocaleContext`,
 * no `localStorage` key and no pathname parsing: each would be a second answer
 * to a question that is already settled, and the pathname one would be a second
 * copy of a rule that has to stay identical to the rewrite's.
 *
 * `Accept-Language` is not read either, and must not be. The browser cannot
 * reproduce that answer during hydration, so it is a guaranteed mismatch.
 */

/**
 * The namespaces the AdminCP shell renders from, and nothing else.
 *
 * `core.global` for the design-system strings every VitNode page needs, and
 * `admin.global` for the shell's own - the sidebar chrome, the search dialog,
 * the user bar. Two namespaces, not the AdminCP's whole message tree: the merged
 * record carries every plugin's admin copy, and shipping all of it to warm a
 * sidebar would send a screen's worth of strings for every screen nobody is
 * looking at.
 *
 * A feature route mounts its own `RouteMessages` with its own namespaces on top
 * of this one - `admin.user` for the users table, `admin.staff` for the six
 * staff screens - and the inner provider wins for the keys it names. That is the
 * same rule `<I18nProvider namespaces={[...]}>` applies in the Next.js AdminCP,
 * so a screen's namespace list survives its migration unchanged.
 *
 * One list, read by both the loader that fetches these and the provider that
 * mounts them, because they have to be the same set or the provider suspends on
 * a key nobody warmed.
 */
export const ADMIN_SHELL_NAMESPACES = ["core.global", "admin.global"] as const;

/**
 * The shell's own namespaces, plus whatever this installation's navigation needs.
 *
 * The sidebar is the one part of the chrome whose strings are not knowable in
 * advance: core's entries are `admin.global`, and a plugin group's heading, its
 * content types' nouns and its declared entries are all under that plugin's own
 * id. `adminNavNamespaces` computes that set from the declarations themselves -
 * see `views/admin/layouts/sidebar/nav/nav-model` - and this is where it joins
 * the two the shell always needs.
 *
 * One function, called by both the loader that warms these and the provider that
 * mounts them, for the same reason the constant above is one list: a loader that
 * warmed a different set fills an entry the provider never looks at, and the
 * first paint costs a round trip anyway.
 *
 * Normalised, so `["core.global","admin.global"]` and the same pair in the other
 * order are one cache entry rather than two holding identical bytes.
 */
export const adminShellNamespaces = (
  navNamespaces: readonly string[] = [],
): string[] =>
  normalizeNamespaceList([...ADMIN_SHELL_NAMESPACES, ...navNamespaces]);

/** The narrowest slice of a route's context the admin loaders read. */
export interface AdminLoaderContext {
  locale: string;
  /**
   * The namespaces this installation's AdminCP navigation renders from, from
   * `adminNavBundle(...)`.
   *
   * The host's, because the navigation is: a package cannot know which plugins
   * an application configured, and the projection that answers that is generated
   * per application. Omitted - a host with core's navigation only - the shell's
   * own two namespaces are the whole set, which is what Stage 12 shipped with.
   */
  namespaces?: readonly string[];
  queryClient: QueryClient;
}

/**
 * Warm the shell's strings for this request's language.
 *
 * `context.locale` rather than a default, so an administrator whose cookie says
 * Polish gets Polish in the first paint rather than English that flips after
 * hydration.
 *
 * The identical `intlQueryOptions` object `RouteMessages` reads back, which is
 * the invariant that makes this worth doing at all: a loader that warms a
 * different locale or a different namespace set fills an entry the provider
 * never looks at, and the first paint costs a round trip anyway.
 */
export const loadAdminMessages = async ({
  locale,
  namespaces,
  queryClient,
}: AdminLoaderContext): Promise<void> => {
  await queryClient.ensureQueryData(
    intlQueryOptions({
      locale,
      namespaces: adminShellNamespaces(namespaces),
    }),
  );
};
