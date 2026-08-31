import type { PluginRoute } from "../../routing/types.js";

import {
  routeMatchKey,
  routeMatchKeyFromTanStackPath,
} from "../../routing/path.js";
import { PLUGIN_ROUTES_ERROR_PREFIX } from "./diagnostics.js";

/**
 * One URL the host application's own route files already claim.
 *
 * `file` is carried alongside the path for one reason, and it is the whole
 * reason this is a record rather than a string: a collision is fixed by editing
 * a file, and "conflicts with `/settings`" makes an author grep for it while
 * "conflicts with `src/routes/_main/settings.tsx`" does not.
 */
export interface HostRoutePath {
  /** Relative to the application root, for the diagnostic. */
  file: string;
  /** In the router's own syntax - `/users/$id`, `/api/$`. */
  path: string;
}

/** Route files, as the extensions a route may be written in. */
const ROUTE_FILE = /\.[cm]?[jt]sx?$/;

/** `foo.d.ts` beside `foo.ts` in a `dist` that got pointed at by mistake. */
const DECLARATION_FILE = /\.d\.[cm]?ts$/;

/** A static segment, once the conventions below have been taken off it. */
const STATIC_TOKEN = /^[a-zA-Z0-9][a-zA-Z0-9._~-]*$/;

/** A parameter name, the same shape a canonical VitNode path allows. */
const PARAM_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** A route group folder - `(app)` - which contributes no URL segment. */
const GROUP_TOKEN = /^\(.*\)$/;

/**
 * Tokens that mean "this file is the route at the path built so far".
 *
 * `index` is the index route of the directory it sits in; `route` is that
 * directory's own route, the file-based spelling of a layout that also has a
 * path. Both claim the prefix rather than adding to it.
 */
const SELF_TOKENS: ReadonlySet<string> = new Set(["index", "route"]);

/**
 * Suffixes that say *how* a route file is loaded, not *where* it is.
 *
 * `posts.lazy.tsx` is the lazily-loaded half of `posts`, so the token is dropped
 * before the path is read off what is left.
 */
const MODIFIER_TOKENS: ReadonlySet<string> = new Set(["lazy"]);

type Token =
  | { kind: "param"; name: string }
  | { kind: "pathless" }
  | { kind: "splat" }
  | { kind: "static"; value: string };

/**
 * One filename token, as the thing it contributes to a URL - or `null`.
 *
 * `null` is "this layer does not know what this is", and it is a decision rather
 * than a gap: the whole file is then skipped and claims nothing. A convention
 * this reader has not been taught can only ever cost a *missed* collision, which
 * the runtime check still catches, and never an *invented* one, which would fail
 * a build over a route file that is perfectly fine.
 */
const readToken = (token: string): null | Token => {
  if (token.length === 0) return null;
  if (GROUP_TOKEN.test(token)) return { kind: "pathless" };

  // `__root` and anything else doubly-underscored is special to the generator
  // rather than a path, and only the first of those is known here.
  if (token.startsWith("__")) return null;
  if (token.startsWith("_")) return { kind: "pathless" };
  if (token === "$") return { kind: "splat" };

  if (token.startsWith("$")) {
    const name = token.slice(1);

    return PARAM_NAME.test(name) ? { kind: "param", name } : null;
  }

  // A trailing underscore breaks a route out of its parent's layout without
  // changing its own segment: `login_.reset-password.tsx` is `/login/reset-password`.
  const value = token.endsWith("_") ? token.slice(0, -1) : token;

  return STATIC_TOKEN.test(value) ? { kind: "static", value } : null;
};

const tokenPath = (tokens: Token[]): string => {
  const segments = tokens.flatMap(token => {
    if (token.kind === "pathless") return [];
    if (token.kind === "splat") return ["$"];
    if (token.kind === "param") return [`$${token.name}`];

    return [token.value];
  });

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
};

/**
 * Every URL a host application's route files claim, read from their names alone.
 *
 * File-based routing is a naming convention, so the paths are in the names and
 * nothing has to be imported to find them: no route module is evaluated, no
 * router is loaded, and this stays a pure function of a list of relative paths -
 * which is also what makes it testable without a filesystem.
 *
 * ## What it is for, and what it is not
 *
 * This is the *build-time* half of the plugin-versus-host collision check. The
 * authoritative half runs where the real route tree exists - `withPluginRoutes`
 * walks it and refuses a plugin route that shadows an application URL - and it
 * cannot be wrong, because it is reading the router's own routes. This one can
 * only be *incomplete*, and is deliberately built so that incomplete is the only
 * way it can be wrong: any token it does not recognise skips the whole file.
 *
 * The point of having it anyway is when the failure lands. Installing a plugin
 * whose page shadows one of the app's own is a mistake that should stop the
 * build that would ship it, next to the manifest error that would stop the build
 * for two plugins colliding - not at the first request that happens to render a
 * router.
 *
 * ## The conventions it reads
 *
 *     __root.tsx                     skipped - the tree's root, not a URL
 *     -components/thing.tsx          skipped - a leading "-" is ignored
 *     index.tsx                      the directory's own URL
 *     route.tsx                      the directory's own URL, as a layout
 *     _main.tsx / (app)/             pathless - contributes no segment
 *     login_.reset-password.tsx      /login/reset-password
 *     posts.$postId.tsx              /posts/$postId
 *     api/$.ts                       /api/$
 *     posts.lazy.tsx                 /posts
 *
 * A `route.tsx` claims its URL even though it is a layout, which matches the
 * runtime rule exactly: in a file-based tree a route with children still renders
 * at its own path, so handing that path to a plugin would shadow it.
 */
export const hostRoutePathsFromFiles = (
  files: readonly string[],
): HostRoutePath[] => {
  const claimed: HostRoutePath[] = [];

  for (const file of files) {
    const normalized = file.replaceAll("\\", "/").replace(/^\.?\//, "");

    if (!ROUTE_FILE.test(normalized) || DECLARATION_FILE.test(normalized)) {
      continue;
    }

    const parts = normalized.split("/");
    const base = parts[parts.length - 1].replace(ROUTE_FILE, "").split(".");

    // Only ever off the end of the *filename*: a directory called `lazy` is a
    // path segment, and dropping it would invent a URL the app does not answer.
    while (base.length > 1 && MODIFIER_TOKENS.has(base[base.length - 1])) {
      base.pop();
    }

    const raw = [
      ...parts.slice(0, -1).flatMap(part => part.split(".")),
      ...base,
    ];

    // A leading "-" is the file-based convention for "not a route" - a folder of
    // components living beside the routes that use them.
    if (raw.some(token => token.startsWith("-")) || raw.length === 0) continue;

    const tokens = raw.map(readToken);

    if (tokens.some(token => token === null)) continue;

    const known = tokens as Token[];
    const last = known[known.length - 1];

    // A pathless layout answers no URL of its own; only its children do.
    if (last.kind === "pathless") continue;

    // A splat swallows every remaining segment, so it can only be the last one.
    // Anywhere else it is a name this reader has misunderstood.
    if (
      known.some(
        (token, index) => token.kind === "splat" && index < known.length - 1,
      )
    ) {
      continue;
    }

    const self =
      last.kind === "static" && SELF_TOKENS.has(last.value)
        ? known.slice(0, -1)
        : known;

    claimed.push({ file: normalized, path: tokenPath(self) });
  }

  return claimed.sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    if (a.file === b.file) return 0;

    return a.file < b.file ? -1 : 1;
  });
};

/**
 * Refuses a plugin route that would answer a URL the application already answers.
 *
 * `buildPluginRouteManifest` rejects two *plugins* claiming one URL and cannot
 * see this case - it never knows which application it is being built for. Left
 * unchecked, the app holds two routes matching one pathname and the router's own
 * ranking picks, which is the "whichever loaded first wins" outcome the whole
 * manifest layer exists to make impossible.
 *
 * Compared by **match key, not by text**, through the one key space
 * `@vitnode/core/routing` owns - so this build-time check and the runtime one
 * cannot disagree about what a collision is:
 *
 *     app     /users/$id      -> /users/:   ┐ collide
 *     plugin  /users/:userId  -> /users/:   ┘
 *
 *     app     /users/new      -> /users/new ┐ do not collide - a router tells
 *     plugin  /users/:id      -> /users/:   ┘ static from dynamic
 *
 * A layout and its index route both spell one path and are two halves of one
 * screen, so a plugin's *layout* is checked against host paths as well: it may
 * add no segment of its own, but the page underneath it will claim the URL.
 */
export const assertNoHostRouteCollision = (
  manifest: readonly PluginRoute[],
  hostRoutes: readonly HostRoutePath[],
): void => {
  if (hostRoutes.length === 0) return;

  const claimed = new Map<string, HostRoutePath>();

  for (const hostRoute of hostRoutes) {
    const key = routeMatchKeyFromTanStackPath(hostRoute.path);

    if (!claimed.has(key)) claimed.set(key, hostRoute);
  }

  for (const route of manifest) {
    const conflict = claimed.get(routeMatchKey(route.segments));

    if (conflict === undefined) continue;

    throw new Error(
      `${PLUGIN_ROUTES_ERROR_PREFIX} Plugin "${route.pluginId}", route "${route.routeId}", claims "${route.path}", which this application already answers with its own route "${conflict.path}" (${conflict.file}). Both match the same URLs, and VitNode will not let a router's ordering decide which one wins - rename the plugin's route, or remove the application's.`,
    );
  }
};
