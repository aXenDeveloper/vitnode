import type { PluginRouteSegment } from "./types";

const segmentRank = (segment: PluginRouteSegment | undefined): number => {
  if (segment === undefined) return 2;

  return { param: 1, splat: 3, static: 0 }[segment.kind];
};

/**
 * Orders routes most specific first: a static segment beats a parameter, which
 * beats a catch-all - the order a router tries them in.
 */
export const compareRouteSpecificity = (
  a: { segments: readonly PluginRouteSegment[] },
  b: { segments: readonly PluginRouteSegment[] },
): number => {
  const length = Math.max(a.segments.length, b.segments.length);

  for (let index = 0; index < length; index++) {
    const difference =
      segmentRank(a.segments[index]) - segmentRank(b.segments[index]);
    if (difference !== 0) return difference;
  }

  return 0;
};

/** Whether a route's segments match the parts of an internal pathname. */
export const routeSegmentsMatch = (
  segments: readonly PluginRouteSegment[],
  parts: readonly string[],
): boolean => {
  for (const [index, segment] of segments.entries()) {
    if (segment.kind === "splat") return parts.length >= index;
    if (index >= parts.length) return false;
    if (
      segment.kind === "static" &&
      segment.value.toLowerCase() !== parts[index].toLowerCase()
    ) {
      return false;
    }
  }

  return segments.length === parts.length;
};

export const pathnameParts = (pathname: string): string[] =>
  pathname.split("/").filter(part => part.length > 0);
