import type { PluginRouteHead, PluginRouteRobots } from "@/routing";

import type {
  LocaleAlternates,
  RouteHeadOptions,
  RouteOpenGraph,
  RouteOpenGraphImage,
  RouteRobots,
} from "../metadata";

import { isInternalPathname } from "../metadata/alternates";

const ROBOTS: readonly PluginRouteRobots[] = [
  "index, follow",
  "noindex, follow",
  "noindex, nofollow",
];

const isRobots = (value: unknown): value is RouteRobots =>
  ROBOTS.includes(value as PluginRouteRobots);

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asAlternates = (value: unknown): LocaleAlternates | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(([, pathname]) =>
    isInternalPathname(pathname),
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const OPEN_GRAPH_TYPES: readonly NonNullable<RouteOpenGraph["type"]>[] = [
  "article",
  "profile",
  "website",
];

const asDimension = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;

/** An absolute `http(s)` URL or a root-relative path; anything else is dropped. */
const asUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value === "") return undefined;
  if (isInternalPathname(value)) return value;

  try {
    const { protocol } = new URL(value);

    return protocol === "http:" || protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
};

const asImage = (value: unknown): RouteOpenGraphImage | undefined => {
  if (typeof value !== "object" || value === null) return undefined;

  const { alt, height, type, url, width } = value as Record<string, unknown>;
  const imageUrl = asUrl(url);
  if (imageUrl === undefined) return undefined;

  return {
    alt: asText(alt),
    height: asDimension(height),
    type: asText(type),
    url: imageUrl,
    width: asDimension(width),
  };
};

const asOpenGraph = (value: unknown): RouteOpenGraph | undefined => {
  if (typeof value !== "object" || value === null) return undefined;

  const { description, image, title, type } = value as Record<string, unknown>;
  const openGraph: RouteOpenGraph = {};
  const ogDescription = asText(description);
  const ogImage = asImage(image);
  const ogTitle = asText(title);

  if (ogDescription !== undefined) openGraph.description = ogDescription;
  if (ogImage !== undefined) openGraph.image = ogImage;
  if (ogTitle !== undefined) openGraph.title = ogTitle;
  if (OPEN_GRAPH_TYPES.includes(type as NonNullable<RouteOpenGraph["type"]>)) {
    openGraph.type = type as NonNullable<RouteOpenGraph["type"]>;
  }

  return openGraph;
};

/** A plugin route's declared head, reduced to the fields a host will render. */
export const normalizePluginRouteHead = (
  declared: unknown,
): RouteHeadOptions => {
  if (typeof declared !== "object" || declared === null) return {};

  const { alternates, canonical, description, openGraph, robots, title } =
    declared as PluginRouteHead;
  const head: RouteHeadOptions = {};

  const pageTitle = asText(title);
  const pageDescription = asText(description);
  const pageAlternates = asAlternates(alternates);
  const pageCanonical = asUrl(canonical);
  const pageOpenGraph = asOpenGraph(openGraph);

  if (pageAlternates !== undefined) head.alternates = pageAlternates;
  if (pageCanonical !== undefined) head.canonical = pageCanonical;
  if (pageDescription !== undefined) head.description = pageDescription;
  if (pageOpenGraph !== undefined) head.openGraph = pageOpenGraph;
  if (isRobots(robots)) head.robots = robots;
  if (pageTitle !== undefined) head.title = pageTitle;

  return head;
};
