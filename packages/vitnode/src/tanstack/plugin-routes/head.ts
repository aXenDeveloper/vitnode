import type { PluginRouteHead, PluginRouteRobots } from "@/routing";

import type { RouteHeadOptions, RouteRobots } from "../metadata";

const ROBOTS: readonly PluginRouteRobots[] = [
  "index, follow",
  "noindex, nofollow",
];

const isRobots = (value: unknown): value is RouteRobots =>
  ROBOTS.includes(value as PluginRouteRobots);

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/** A plugin route's declared head, reduced to the fields a host will render. */
export const normalizePluginRouteHead = (
  declared: unknown,
): RouteHeadOptions => {
  if (typeof declared !== "object" || declared === null) return {};

  const { description, robots, title } = declared as PluginRouteHead;
  const head: RouteHeadOptions = {};

  const pageTitle = asText(title);
  const pageDescription = asText(description);

  if (pageDescription !== undefined) head.description = pageDescription;
  if (isRobots(robots)) head.robots = robots;
  if (pageTitle !== undefined) head.title = pageTitle;

  return head;
};
