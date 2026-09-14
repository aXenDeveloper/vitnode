import type { PluginRoute, PluginRouteSegment } from "./types";

/**
 * How specific a segment is: the narrower set of URLs sorts first.
 *
 * A static segment matches one, a parameter matches one of anything, a catch-all
 * matches every remaining segment - so this is the order a reader expects a
 * manifest in, and the order a router would have to resolve them in anyway.
 */
const SEGMENT_RANK: Record<PluginRouteSegment["kind"], number> = {
  param: 1,
  splat: 2,
  static: 0,
};

/** A segment's own text, for breaking a tie between two of the same kind. */
const segmentText = (segment: PluginRouteSegment): string => {
  switch (segment.kind) {
    case "param":
      return segment.name;
    case "splat":
      return "";
    case "static":
      return segment.value;
  }
};

const compareSegments = (
  a: PluginRouteSegment[],
  b: PluginRouteSegment[],
): number => {
  const shared = Math.min(a.length, b.length);

  for (let index = 0; index < shared; index += 1) {
    const left = a[index];
    const right = b[index];

    if (left.kind !== right.kind) {
      return SEGMENT_RANK[left.kind] - SEGMENT_RANK[right.kind];
    }

    const leftText = segmentText(left);
    const rightText = segmentText(right);

    if (leftText !== rightText) {
      return leftText < rightText ? -1 : 1;
    }
  }

  return a.length - b.length;
};

export const comparePluginRoutes = (a: PluginRoute, b: PluginRoute): number => {
  const bySegments = compareSegments(a.segments, b.segments);

  if (bySegments !== 0) return bySegments;
  if (a.id === b.id) return 0;

  return a.id < b.id ? -1 : 1;
};
