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

const asDimension = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;

const asImage = (value: unknown): RouteOpenGraphImage | undefined => {
  if (typeof value !== "object" || value === null) return undefined;

  const { alt, height, type, url, width } = value as Record<string, unknown>;
  const href = asText(url);
  if (href === undefined) return undefined;

  const image: RouteOpenGraphImage = { url: href };
  const imageAlt = asText(alt);
  const imageType = asText(type);
  const imageWidth = asDimension(width);
  const imageHeight = asDimension(height);
  if (imageAlt !== undefined) image.alt = imageAlt;
  if (imageType !== undefined) image.type = imageType;
  if (imageWidth !== undefined) image.width = imageWidth;
  if (imageHeight !== undefined) image.height = imageHeight;

  return image;
};

const asOpenGraph = (value: unknown): RouteOpenGraph | undefined => {
  if (typeof value !== "object" || value === null) return undefined;

  const { description, image, title, type } = value as Record<string, unknown>;
  const openGraph: RouteOpenGraph = {};
  const ogTitle = asText(title);
  const ogDescription = asText(description);
  const ogImage = asImage(image);
  if (ogTitle !== undefined) openGraph.title = ogTitle;
  if (ogDescription !== undefined) openGraph.description = ogDescription;
  if (ogImage !== undefined) openGraph.image = ogImage;
  if (type === "article" || type === "website") openGraph.type = type;

  return Object.keys(openGraph).length > 0 ? openGraph : undefined;
};

/** A plugin route's declared head, reduced to the fields a host will render. */
export const normalizePluginRouteHead = (
  declared: unknown,
): RouteHeadOptions => {
  if (typeof declared !== "object" || declared === null) return {};

  const { alternates, description, openGraph, robots, title } =
    declared as PluginRouteHead;
  const head: RouteHeadOptions = {};

  const pageTitle = asText(title);
  const pageDescription = asText(description);
  const pageAlternates = asAlternates(alternates);
  const pageOpenGraph = asOpenGraph(openGraph);

  if (pageAlternates !== undefined) head.alternates = pageAlternates;
  if (pageDescription !== undefined) head.description = pageDescription;
  if (pageOpenGraph !== undefined) head.openGraph = pageOpenGraph;
  if (isRobots(robots)) head.robots = robots;
  if (pageTitle !== undefined) head.title = pageTitle;

  return head;
};
