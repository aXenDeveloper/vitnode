import type { PluginRoute } from "../../routing/types.js";

import { routeMatchKey } from "../../routing/path.js";
import { PLUGIN_ROUTES_ERROR_PREFIX } from "./diagnostics.js";

/**
 * URLs the Next.js application still answers, and a refusal to let a plugin
 * route take one.
 *
 * **Migration-only. Delete this file at the Next.js cutover**, together with
 * `scripts/prepare-plugins-files.ts` and `scripts/legacy-route-overlap.ts`. It
 * is reachable from the compiler through one optional field
 * (`CompilePluginRoutesOptions.legacyRoutes`) which defaults to "none", so
 * deleting it is deleting this file, that field and the block in
 * `framework/vite/plugin-routes.ts` that fills it.
 *
 * ## The hole it closes
 *
 * During the strangler migration two applications serve one site, and a URL a
 * plugin route claims is a URL some page in one of them already answers.
 * Nothing joins the two but `MigrationLink`, which asks the TanStack router
 * whether it owns a path and renders a document navigation when it does not -
 * so the route tree is what decides, and a plugin route is a way to change it.
 *
 * A plugin declaring
 *
 *     { area: "admin", id: "posts", path: "/admin/content/blog" }
 *
 * creates a real TanStack route at that URL, and it breaks whichever
 * application owns that namespace. Before Stage 13 it stole a working Next.js
 * content screen: `isTanStackOwnedPath` began answering `true`,
 * `MigrationLink` rendered a client navigation, and the screen became a
 * TanStack not-found. Since Stage 13 it collides with the Content Engine's own
 * splat instead, which is no better - two routes matching one path, and no
 * error anywhere, because every layer did precisely what it was told.
 *
 * `assertNoHostRouteCollision` cannot see either case: it compares against a
 * host's *own route files*, and the pages that claim `/admin/content/*` are a
 * package's - shipped into a Next.js app by the copier, and mounted in a
 * TanStack app under one splat.
 *
 * ## Derived, never listed
 *
 * The legacy URLs are read off the route sources the copier already ships -
 * `@vitnode/core`'s `src/routes/admin/**`, the same directory
 * `prepare-plugins-files.ts` copies into every Next.js app's `src/app/`. So this
 * has no list to maintain: a legacy admin screen that moves to TanStack stops
 * being a `page.tsx` under `routes/admin/` and stops being claimed here, in the
 * same commit, by the same edit.
 *
 * Same discipline as `hostRoutePathsFromFiles`, and for the same reason: a
 * filename token this reader does not recognise skips the whole file, so being
 * wrong can only ever mean *missing* a collision - which is the status quo -
 * and never inventing one, which would fail a build over a legacy page that is
 * perfectly fine.
 */

/** One URL - or one subtree of them - that the Next.js application still owns. */
export interface LegacyRoutePath {
  /**
   * Where the claim comes from, relative to the package that ships it.
   *
   * Carried for the diagnostic and for no other reason: a collision is resolved
   * by knowing which page already answers the URL, and
   * "`src/routes/admin/content/[...slug]/page.tsx`" says that while
   * "`/admin/content`" makes somebody grep for it.
   */
  file: string;
  /**
   * The URLs this page answers, as a key in `@vitnode/core/routing`'s one key
   * space - parameters collapsed to `:`, so it compares with
   * {@link routeMatchKey} over a plugin route's segments.
   */
  key: string;
  /** The path as its author wrote it, in Next's spelling, for the diagnostic. */
  path: string;
  /**
   * This page is a catch-all: it owns {@link LegacyRoutePath.key} and every URL
   * beneath it.
   *
   * The reason this is a flag rather than another key. `routeMatchKey`'s promise
   * is that equal keys mean equal sets of URLs, and a splat breaks it - it
   * swallows every remaining segment, so `/admin/content/[...slug]` and
   * `/admin/content/:x` are not the same set. Comparing by equality alone would
   * let `/admin/content/blog` through, which is the single URL this whole
   * mechanism exists to protect.
   */
  subtree: boolean;
}

/** Route files, as the extensions a Next.js route may be written in. */
const ROUTE_FILE = /\.[cm]?[jt]sx?$/;

/** `page.tsx` beside `page.d.ts` in a `dist` that got pointed at by mistake. */
const DECLARATION_FILE = /\.d\.[cm]?ts$/;

/**
 * Filenames that claim the URL of the directory they sit in.
 *
 * Everything else under `app/` - `layout`, `loading`, `error`, `template`,
 * `default`, `not-found` - renders *around* or *instead of* a page and answers
 * no URL of its own, so a directory holding only those claims nothing.
 */
const URL_CLAIMING_FILES: ReadonlySet<string> = new Set(["page", "route"]);

/** A static segment, conservative: the shape a canonical VitNode path allows. */
const STATIC_TOKEN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/** A parameter name, the same shape a canonical VitNode path allows. */
const PARAM_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** `(marketing)` - a route group, which contributes no URL segment. */
const GROUP_TOKEN = /^\(.+\)$/;

/** `[...slug]` and `[[...slug]]` - a catch-all, which owns its whole subtree. */
const CATCH_ALL_TOKEN = /^\[{1,2}\.\.\.(.+?)\]{1,2}$/;

/** `[id]` - one dynamic segment. */
const PARAM_TOKEN = /^\[(.+)\]$/;

type Token =
  | { kind: "catch-all" }
  | { kind: "param" }
  | { kind: "pathless" }
  | { kind: "static"; value: string };

/**
 * One directory name, as the thing it contributes to a URL - or `null`.
 *
 * `null` means "this reader has not been taught what this is", and the file is
 * then skipped entirely rather than guessed at. `@slot` (a parallel route) and
 * `_private` (a folder Next excludes from routing) are deliberately in that
 * bucket: neither claims the URL it looks like it claims, and treating them as
 * static segments would invent one.
 */
const readToken = (token: string): null | Token => {
  if (token.length === 0) return null;
  if (GROUP_TOKEN.test(token)) return { kind: "pathless" };
  if (token.startsWith("@") || token.startsWith("_")) return null;

  if (CATCH_ALL_TOKEN.test(token)) {
    const [, name] = CATCH_ALL_TOKEN.exec(token) ?? [];

    return name !== undefined && PARAM_NAME.test(name)
      ? { kind: "catch-all" }
      : null;
  }

  if (PARAM_TOKEN.test(token)) {
    const [, name] = PARAM_TOKEN.exec(token) ?? [];

    return name !== undefined && PARAM_NAME.test(name)
      ? { kind: "param" }
      : null;
  }

  return STATIC_TOKEN.test(token) ? { kind: "static", value: token } : null;
};

/**
 * Every URL the Next.js AdminCP still answers, read from its route files alone.
 *
 * `files` are paths relative to a plugin's `src/routes/admin/`, which is the
 * directory the legacy copier descends into - so `content/[...slug]/page.tsx`
 * becomes `/admin/content/**` and `core/users/[id]/page.tsx` becomes
 * `/admin/core/users/:`. The `/admin` prefix is added here because that is what
 * the copier's destination adds: those files land under
 * `app/[locale]/admin/(auth)/…`.
 *
 * Pure, so it is testable without a filesystem, and total: an unreadable name
 * costs its own file and nothing else.
 *
 * A catch-all stops the walk - segments after one are unreachable - and yields
 * the prefix it guards, with `subtree` set. `/admin/content/[...slug]` therefore
 * claims `/admin/content` and everything under it, which is deliberately one
 * segment more than Next matches: a required catch-all does not answer
 * `/admin/content` itself. Being broad here costs a plugin the ability to claim
 * the root of a legacy subtree, which during a migration is the right way round.
 */
export const legacyAdminRoutePathsFromFiles = (
  files: readonly string[],
): LegacyRoutePath[] => {
  const claimed: LegacyRoutePath[] = [];

  for (const file of files) {
    const normalized = file.replaceAll("\\", "/").replace(/^\.?\//, "");

    if (!ROUTE_FILE.test(normalized) || DECLARATION_FILE.test(normalized)) {
      continue;
    }

    const parts = normalized.split("/");
    const basename = parts[parts.length - 1].replace(ROUTE_FILE, "");

    if (!URL_CLAIMING_FILES.has(basename)) continue;

    const tokens = parts.slice(0, -1).map(readToken);

    if (tokens.some(token => token === null)) continue;

    const segments: string[] = [];
    let subtree = false;

    for (const token of tokens as Token[]) {
      if (token.kind === "catch-all") {
        subtree = true;
        break;
      }

      if (token.kind === "pathless") continue;

      segments.push(token.kind === "param" ? ":" : token.value.toLowerCase());
    }

    const key = `/admin${segments.map(segment => `/${segment}`).join("")}`;

    claimed.push({
      file: `src/routes/admin/${normalized}`,
      key,
      path: `/admin/${parts.slice(0, -1).join("/")}`.replace(/\/$/, ""),
      subtree,
    });
  }

  return claimed.sort((a, b) => {
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    if (a.file === b.file) return 0;

    return a.file < b.file ? -1 : 1;
  });
};

/**
 * Refuses a plugin route that would take a URL the Next.js application still
 * answers.
 *
 * Checked against **every** plugin route rather than only the `admin` ones. An
 * area chooses a shell and never a prefix, so `{ area: "main", path:
 * "/admin/content/blog" }` is a legal declaration that claims a legacy URL just
 * as thoroughly - and more confusingly, since it would render the Content
 * Engine's URL with the public site's header.
 *
 * An error rather than a warning, unlike `legacyRouteOverlaps`, and the
 * difference is what each one costs. That one catches a plugin whose files are
 * copied somewhere harmless; this one catches a plugin that silently turns every
 * screen of a working application into a not-found.
 */
export const assertNoLegacyRouteCollision = (
  manifest: readonly PluginRoute[],
  legacyRoutes: readonly LegacyRoutePath[],
): void => {
  if (legacyRoutes.length === 0) return;

  for (const route of manifest) {
    const key = routeMatchKey(route.segments);

    for (const legacy of legacyRoutes) {
      const collides = legacy.subtree
        ? key === legacy.key || key.startsWith(`${legacy.key}/`)
        : key === legacy.key;

      if (!collides) continue;

      throw new Error(
        `${PLUGIN_ROUTES_ERROR_PREFIX} Plugin "${route.pluginId}", route "${route.routeId}", claims "${route.path}", which the Next.js application still answers with "${legacy.path}" (${legacy.file})${legacy.subtree ? " and everything beneath it" : ""}. That page has not been migrated yet, and a TanStack route at this URL would take it over silently - links to it would stop leaving this application and the screen would become a not-found. Pick another path, or migrate that page first.`,
      );
    }
  }
};
