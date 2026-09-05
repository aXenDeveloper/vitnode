import type { PluginRoute, PluginRouteSegment } from "./types";

const compareSegments = (
  a: PluginRouteSegment[],
  b: PluginRouteSegment[],
): number => {
  const shared = Math.min(a.length, b.length);

  for (let index = 0; index < shared; index += 1) {
    const left = a[index];
    const right = b[index];

    if (left.kind !== right.kind) {
      return left.kind === "static" ? -1 : 1;
    }

    const leftText = left.kind === "static" ? left.value : left.name;
    const rightText = right.kind === "static" ? right.value : right.name;

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
