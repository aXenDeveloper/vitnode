import type { PluginRouteSegment } from "./types";

/**
 * A static segment: a literal piece of URL.
 *
 * Percent-encoding, spaces and uppercase are all left out. A plugin author who
 * needs one of those in a public URL has a naming problem, not a routing
 * problem, and a route table full of `%20` is nobody's idea of a good time.
 */
const STATIC_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

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

  if (!STATIC_SEGMENT.test(raw)) {
    return {
      reason: `"${raw}" is not a valid path segment - use letters, digits, "-", "_" and "."`,
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
