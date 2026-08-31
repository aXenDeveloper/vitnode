import type { PluginRouteSegment } from "./types";

/**
 * A static segment: a literal piece of URL, and lowercase.
 *
 * Percent-encoding, spaces and uppercase are all left out. A plugin author who
 * needs one of the first two in a public URL has a naming problem, not a routing
 * problem, and a route table full of `%20` is nobody's idea of a good time.
 *
 * Uppercase is excluded for a sharper reason: the routers that consume this
 * manifest match paths **case-insensitively**, so `/Example` and `/example`
 * answer the same URL. Accepting both would mean two manifest paths that
 * `routeMatchKey` calls different and a browser calls identical - a collision the
 * validation could not see. One canonical spelling removes the question.
 */
const STATIC_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/;

/** A parameter name, i.e. a JavaScript-ish identifier - it becomes one. */
const PARAM_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Next.js filesystem syntax: `[id]`, `[...slug]`, `[[...slug]]`. */
const NEXT_SEGMENT = /^\[.*\]$/;

export type ParseRoutePathResult =
  | { ok: false; reason: string }
  | { ok: true; path: string; segments: PluginRouteSegment[] };

const parseSegment = (
  raw: string,
): { reason: string } | { segment: PluginRouteSegment } => {
  if (raw.length === 0) {
    return { reason: "it has an empty segment" };
  }

  if (NEXT_SEGMENT.test(raw)) {
    const name = raw.replace(/^\[+\.{0,3}|\]+$/g, "");

    return {
      reason: `"${raw}" is Next.js filesystem syntax - write ":${name || "name"}" instead`,
    };
  }

  if (raw.startsWith("$")) {
    return {
      reason: `"${raw}" is TanStack Router syntax - write ":${raw.slice(1) || "name"}" instead`,
    };
  }

  if (raw === "*" || raw === "**") {
    return {
      reason: `"${raw}" is a catch-all segment, which VitNode route paths do not represent yet`,
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

/**
 * Reads a canonical VitNode route path.
 *
 * The one fallible function in this module, and the only place a path string is
 * ever interpreted. Everything else takes segments, which cannot be malformed,
 * so no caller has to remember to handle an error twice.
 *
 * Returns a result rather than throwing: the manifest builder wants to attach
 * the plugin and the route id to the failure, and an exception thrown from here
 * would not know either.
 */
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

    segments.push(parsed.segment);
  }

  return { ok: true, path: formatRoutePath(segments), segments };
};

/** Segments back to their canonical VitNode path. */
export function formatRoutePath(segments: PluginRouteSegment[]): string {
  if (segments.length === 0) return "/";

  return `/${segments
    .map(segment =>
      segment.kind === "param" ? `:${segment.name}` : segment.value,
    )
    .join("/")}`;
}

/**
 * Segments to Next.js filesystem syntax, `/blog/[slug]`.
 *
 * Here rather than in the Next.js layer because it is the same three lines as
 * its TanStack twin, and keeping the pair together is what stops the two
 * conversions from drifting into two different ideas of what a path is.
 */
export const toNextRoutePath = (segments: PluginRouteSegment[]): string => {
  if (segments.length === 0) return "/";

  return `/${segments
    .map(segment =>
      segment.kind === "param" ? `[${segment.name}]` : segment.value,
    )
    .join("/")}`;
};

/** Segments to TanStack Router syntax, `/blog/$slug`. */
export const toTanStackRoutePath = (segments: PluginRouteSegment[]): string => {
  if (segments.length === 0) return "/";

  return `/${segments
    .map(segment =>
      segment.kind === "param" ? `$${segment.name}` : segment.value,
    )
    .join("/")}`;
};

/**
 * The set of URLs a path matches, as a comparable string.
 *
 * `/blog/:slug` and `/blog/:postId` are two spellings of one route: they match
 * exactly the same URLs, and an application that accepted both would answer
 * `/blog/hello` differently depending on which plugin loaded first. Collapsing
 * every parameter to `:` is what turns that into a collision the manifest can
 * refuse rather than a race it silently resolves.
 */
export const routeMatchKey = (segments: PluginRouteSegment[]): string => {
  if (segments.length === 0) return "/";

  return `/${segments
    .map(segment => (segment.kind === "param" ? ":" : segment.value))
    .join("/")}`;
};

/**
 * A splat, in a {@link routeMatchKeyFromTanStackPath} key.
 *
 * Deliberately not `:`. A splat swallows every remaining segment and a parameter
 * swallows exactly one, so `/api/$` and `/api/:id` do *not* match the same URLs -
 * `/api/a/b` reaches only the first. Giving them one key would break the single
 * promise this whole key space makes: equal keys mean equal sets of URLs. No
 * canonical VitNode path can produce this marker, because `parseRoutePath`
 * rejects catch-alls outright, so a plugin route can never collide with an
 * application's splat by key.
 */
const MATCH_KEY_SPLAT = "**";

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

    if (there.kind !== "param" || here.name !== there.name) return null;
  }

  return child.slice(parent.length);
};
