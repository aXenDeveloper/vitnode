import type { PluginRouteSegment } from "./types";

const STATIC_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/;

/** A parameter name, i.e. a JavaScript-ish identifier - it becomes one. */
const PARAM_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Bracket filesystem syntax: `[id]`, `[...slug]`, `[[...slug]]`. */
const BRACKET_SEGMENT = /^\[.*\]$/;

export type ParseRoutePathResult =
  | { ok: false; reason: string }
  | { ok: true; path: string; segments: PluginRouteSegment[] };

const parseSegment = (
  raw: string,
): { reason: string } | { segment: PluginRouteSegment } => {
  if (raw.length === 0) {
    return { reason: "it has an empty segment" };
  }

  if (BRACKET_SEGMENT.test(raw)) {
    const name = raw.replace(/^\[+\.{0,3}|\]+$/g, "");

    return {
      reason: `"${raw}" is bracket filesystem syntax - write ":${name || "name"}" instead`,
    };
  }

  if (raw.startsWith("$")) {
    return {
      reason:
        raw === "$"
          ? '"$" is TanStack Router syntax for a catch-all - write "*" instead'
          : `"${raw}" is TanStack Router syntax - write ":${raw.slice(1) || "name"}" instead`,
    };
  }

  if (raw === "*") {
    return { segment: { kind: "splat" } };
  }

  if (raw === "**") {
    return {
      reason: `"${raw}" is not how VitNode spells a catch-all - write "*" instead`,
    };
  }

  if (raw.startsWith(":")) {
    const name = raw.slice(1);

    if (name.endsWith("?")) {
      return {
        reason: `"${raw}" is an optional segment, which VitNode route paths do not represent yet`,
      };
    }

    if (name.endsWith("*") || name.endsWith("+")) {
      return {
        reason: `"${raw}" is a repeating segment, which VitNode route paths do not represent yet`,
      };
    }

    if (!PARAM_NAME.test(name)) {
      return {
        reason: `":${name}" is not a valid parameter name - use letters, digits and underscores, starting with a letter`,
      };
    }

    return { segment: { kind: "param", name } };
  }

  if (raw.includes("?")) {
    return {
      reason: `"${raw}" looks like a query string, which is not part of a route path`,
    };
  }

  // Named before the general rule, and never lowercased silently: a plugin's
  // public URL changing behind its author's back is worse than a build error
  // that says exactly what to write.
  if (/[A-Z]/.test(raw)) {
    return {
      reason: `"${raw}" has uppercase letters - VitNode route paths are lowercase, because a router matches them case-insensitively and "/${raw}" and "/${raw.toLowerCase()}" would be one URL. Write "${raw.toLowerCase()}" instead`,
    };
  }

  if (!STATIC_SEGMENT.test(raw)) {
    return {
      reason: `"${raw}" is not a valid path segment - use lowercase letters, digits, "-", "_" and "."`,
    };
  }

  return { segment: { kind: "static", value: raw } };
};

export const parseRoutePath = (path: string): ParseRoutePathResult => {
  if (typeof path !== "string" || path.length === 0) {
    return { ok: false, reason: "a route path must be a non-empty string" };
  }

  if (!path.startsWith("/")) {
    return { ok: false, reason: `"${path}" must start with "/"` };
  }

  if (/[#\s]/.test(path)) {
    return {
      ok: false,
      reason: `"${path}" must not contain whitespace or a hash`,
    };
  }

  if (path === "/") {
    return { ok: true, path: "/", segments: [] };
  }

  // One trailing slash is a formatting difference, not a different route.
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const segments: PluginRouteSegment[] = [];
  const params = new Set<string>();

  for (const raw of trimmed.slice(1).split("/")) {
    const parsed = parseSegment(raw);

    if ("reason" in parsed) {
      return {
        ok: false,
        reason: `"${path}" is not a valid path: ${parsed.reason}`,
      };
    }

    if (parsed.segment.kind === "param") {
      if (params.has(parsed.segment.name)) {
        return {
          ok: false,
          reason: `"${path}" declares ":${parsed.segment.name}" twice`,
        };
      }

      params.add(parsed.segment.name);
    }

    // Checked as the *previous* segment gains a successor rather than by index,
    // so the rule reads the same however the loop is written: a splat swallows
    // everything after it, so there is nothing for a later segment to match.
    if (segments.at(-1)?.kind === "splat") {
      return {
        ok: false,
        reason: `"${path}" has a segment after its "*" - a catch-all matches every remaining segment, so it can only be last`,
      };
    }

    segments.push(parsed.segment);
  }

  return { ok: true, path: formatRoutePath(segments), segments };
};

/**
 * A splat, in a route match key.
 *
 * Deliberately not `:`. A splat swallows every remaining segment and a parameter
 * swallows exactly one, so `/api/*` and `/api/:id` do *not* match the same URLs -
 * `/api/a/b` reaches only the first. Giving them one key would break the single
 * promise this whole key space makes: equal keys mean equal sets of URLs.
 *
 * Reached from both entrances - a VitNode path's `*` through {@link routeMatchKey}
 * and an application's `$` through {@link routeMatchKeyFromTanStackPath} - so a
 * plugin catch-all and an application catch-all at one URL collide, which is the
 * whole point.
 */
const MATCH_KEY_SPLAT = "**";

/**
 * One segment in each of the four spellings this module emits.
 *
 * Written once, as a total function over the segment union, so a new kind of
 * segment is a compile error in every projection at once rather than an
 * `undefined` that reaches a router as the string "undefined".
 */
const projectSegment = (
  segment: PluginRouteSegment,
  spelling: {
    param: (name: string) => string;
    splat: string;
  },
): string => {
  switch (segment.kind) {
    case "param":
      return spelling.param(segment.name);
    case "splat":
      return spelling.splat;
    case "static":
      return segment.value;
  }
};

const projectPath = (
  segments: PluginRouteSegment[],
  spelling: { param: (name: string) => string; splat: string },
): string => {
  if (segments.length === 0) return "/";

  return `/${segments.map(segment => projectSegment(segment, spelling)).join("/")}`;
};

/** Segments back to their canonical VitNode path. */
export function formatRoutePath(segments: PluginRouteSegment[]): string {
  return projectPath(segments, { param: name => `:${name}`, splat: "*" });
}

export const toNextRoutePath = (segments: PluginRouteSegment[]): string =>
  projectPath(segments, { param: name => `[${name}]`, splat: "[...slug]" });

/** Segments to TanStack Router syntax, `/blog/$slug` and `/admin/content/$`. */
export const toTanStackRoutePath = (segments: PluginRouteSegment[]): string =>
  projectPath(segments, { param: name => `$${name}`, splat: "$" });

export const routeMatchKey = (segments: PluginRouteSegment[]): string =>
  projectPath(segments, { param: () => ":", splat: MATCH_KEY_SPLAT });

/**
 * {@link routeMatchKey}, for a path already written in TanStack Router syntax.
 *
 * The second entrance to one key space, and the reason plugin-vs-plugin and
 * plugin-vs-application collisions are the same question asked twice rather than
 * two rules that agree until somebody edits one. A plugin route arrives as parsed
 * segments and goes through `routeMatchKey`; an application's own route arrives
 * as the string its router already holds - `/users/$id` - and comes through here.
 * Both land on `/users/:`, so they compare.
 *
 *     /users/$id      -> /users/:
 *     /users/$userId  -> /users/:      (a parameter's name is not part of a URL)
 *     /users/new      -> /users/new    (a router tells static from dynamic)
 *     /blog/$slug/x   -> /blog/:/x
 *     /discover/      -> /discover     (an index route under a layout)
 *     /api/$          -> /api/**       (see MATCH_KEY_SPLAT)
 *
 * Framework-neutral despite the name: `$id` is treated as *input syntax*, the
 * same way `toTanStackRoutePath` treats it as output syntax. Nothing here imports
 * a router, and nothing here may - see `boundaries.test.ts`.
 */
export const routeMatchKeyFromTanStackPath = (path: string): string => {
  // A route may declare `/`, and a layout's index child joins to `/blog/` -
  // which is the same URL as `/blog`. One trailing slash is formatting.
  const trimmed =
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

  if (trimmed === "" || trimmed === "/") return "/";

  return `/${trimmed
    .replace(/^\//, "")
    .split("/")
    .filter(segment => segment.length > 0)
    .map(segment => {
      if (segment === "$") return MATCH_KEY_SPLAT;
      if (segment.startsWith("$")) return ":";

      // Lowercased because a router matches case-insensitively, so an
      // application route at `/Users` and a plugin route at `/users` are one
      // URL. Plugin paths are already lowercase by construction - `parseRoutePath`
      // refuses anything else - and an app's own route files are not.
      return segment.toLowerCase();
    })
    .join("/")}`;
};

/**
 * The child's path with its parent's prefix removed, or `null` if the child is
 * not under the parent at all.
 *
 * The whole of what "a nested route declares its full path" costs, and the
 * reason it is worth paying: a manifest that spells `/settings/security` out is
 * readable and greppable and collides visibly, and this is the one function that
 * has to turn it back into the `/security` a router composes.
 *
 * Segments are compared by *identity*, not just by shape - a parameter's name
 * has to match too. A layout at `/blog/:slug` with a child declaring
 * `/blog/:postId/comments` would compose to `/blog/$slug/comments`, and the
 * child's `:postId` would never exist: the parent named that segment. Rejecting
 * it here is what turns a page whose `params.postId` is silently `undefined`
 * into a build error.
 *
 * An empty result is the child claiming exactly its parent's URL - a layout's
 * index route - and is a success, not a failure. `null` is the only failure.
 */
export const relativeRouteSegments = (
  parent: readonly PluginRouteSegment[],
  child: readonly PluginRouteSegment[],
): null | PluginRouteSegment[] => {
  if (child.length < parent.length) return null;

  for (let index = 0; index < parent.length; index += 1) {
    const here = parent[index];
    const there = child[index];

    if (here.kind !== there.kind) return null;

    if (here.kind === "static") {
      if (there.kind !== "static" || here.value !== there.value) return null;
      continue;
    }

    // A splat carries no name, so matching kinds is the whole comparison. It can
    // only ever be a parent's last segment, and `parseRoutePath` has already
    // refused anything after one - so a child that got this far claims exactly
    // its parent's URL.
    if (here.kind === "splat") continue;

    if (there.kind !== "param" || here.name !== there.name) return null;
  }

  return child.slice(parent.length);
};
