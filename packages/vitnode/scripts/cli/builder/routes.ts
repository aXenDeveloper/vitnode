import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type RouteMode = "dynamic" | "partial" | "static";

export interface BuildRoute {
  mode: RouteMode;
  path: string;
  staticPaths: string[];
}

interface RouteReportApi {
  routeReport: (htmlPaths: readonly string[]) => BuildRoute[];
}

const ROUTES_PLUGIN = "vitnode:plugin-routes";

const isRouteReportApi = (api: unknown): api is RouteReportApi =>
  typeof api === "object" &&
  api !== null &&
  typeof (api as { routeReport?: unknown }).routeReport === "function";

export const routeReportApiOf = (
  plugins: readonly { api?: unknown; name: string }[],
): null | RouteReportApi => {
  const plugin = plugins.find(candidate => candidate.name === ROUTES_PLUGIN);

  return plugin !== undefined && isRouteReportApi(plugin.api)
    ? plugin.api
    : null;
};

const htmlFilesUnder = (directory: string, prefix = ""): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith(".")) return [];

    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      return htmlFilesUnder(join(directory, entry.name), relative);
    }

    return entry.name.endsWith(".html") ? [relative] : [];
  });

export const urlPathOfHtmlFile = (file: string): string => {
  if (file === "index.html") return "/";
  if (file.endsWith("/index.html")) {
    return `/${file.slice(0, -"/index.html".length)}`;
  }

  return `/${file.slice(0, -".html".length)}`;
};

export const htmlPathsUnder = (directory: string): string[] =>
  existsSync(directory)
    ? htmlFilesUnder(directory).map(urlPathOfHtmlFile).sort()
    : [];
