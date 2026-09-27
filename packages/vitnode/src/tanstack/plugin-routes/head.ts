import type { PluginRouteHead, PluginRouteRobots } from "@/routing";

import type {
  LocaleAlternates,
  RouteHeadOptions,
  RouteRobots,
} from "../metadata";

import { isInternalPathname } from "../metadata/alternates";

const ROBOTS: readonly PluginRouteRobots[] = [
  "index, follow",
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

/** A plugin route's declared head, reduced to the fields a host will render. */
export const normalizePluginRouteHead = (
  declared: unknown,
): RouteHeadOptions => {
  if (typeof declared !== "object" || declared === null) return {};

  const { alternates, description, robots, title } =
    declared as PluginRouteHead;
  const head: RouteHeadOptions = {};

  const pageTitle = asText(title);
  const pageDescription = asText(description);
  const pageAlternates = asAlternates(alternates);

  if (pageAlternates !== undefined) head.alternates = pageAlternates;
  if (pageDescription !== undefined) head.description = pageDescription;
  if (isRobots(robots)) head.robots = robots;
  if (pageTitle !== undefined) head.title = pageTitle;

  return head;
};
