import type { PluginRouteHead, PluginRouteRobots } from "@/routing";

import type { RouteHeadOptions, RouteRobots } from "../metadata";

/**
 * A plugin page's metadata, on its way into the host's own `head` rule.
 *
 * `PluginRouteHead` and `RouteHeadOptions` are structurally the same three
 * fields, and that is deliberate rather than lucky: the routing layer declares
 * its own copy because it may not import this one, and the copy is shaped so
 * that a plugin's title goes through exactly the `"<page> - <site>"` rule every
 * VitNode page's does. What is *not* shared is trust. A plugin route's `head` is
 * a function from a compiled package, run inside the host's document, so what
 * comes back is read field by field rather than spread.
 *
 * Total, and it never throws. A plugin that returns the wrong shape gets a page
 * with no metadata rather than a page that fails to render: `head` runs inside
 * the router's own try/catch, so throwing here would lose the tab title *and*
 * print a stack somebody has to read - and the compile-time `satisfies
 * PluginRouteHead` on the plugin's side is where a typo is meant to be caught.
 *
 * `robots` is the one field checked by value rather than by type, because it is
 * the one whose wrong value is not visibly wrong: an unknown string reaches
 * `<meta name="robots">` and tells a crawler something nobody meant. Only the
 * two directives the contract names survive.
 */
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
