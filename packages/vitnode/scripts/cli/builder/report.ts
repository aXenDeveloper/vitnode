import { formatPageCachePolicy } from "@/page-cache/policy";

import type { Ui } from "../ui/ui";
import type { ChunkAnalysis } from "./analysis";
import type { FileCategory, MeasuredFile } from "./output-files";
import type {
  BuildRoute,
  BuildRouteReport,
  PageCacheStorageKind,
  RouteMode,
} from "./routes";
import type { SizeSeverity } from "./size-severity";
import type { SnapshotComparison } from "./snapshot";
import type { BuildWarning } from "./warnings";

import { padEnd, padStart } from "../ui/colors";
import {
  formatByteDelta,
  formatBytes,
  formatPercent,
  formatPercentDelta,
  plural,
} from "../ui/format";
import { classifySize } from "./size-severity";
import { isNotableGrowth } from "./snapshot";

const GROUPS: { category: FileCategory; limit: number; title: string }[] = [
  { category: "client-js", limit: 10, title: "Client JS" },
  { category: "css", limit: 5, title: "CSS" },
  { category: "asset", limit: 5, title: "Assets" },
  { category: "other", limit: 5, title: "Other" },
  { category: "server", limit: 5, title: "Server" },
];

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

/** Severity as a symbol and a color, so neither is the only signal. */
export const severityStyle = (ui: Ui, severity: SizeSeverity) => {
  const { colors, symbols } = ui;

  switch (severity) {
    case "good":
      return { paint: colors.success, symbol: colors.success(symbols.success) };
    case "large":
      return { paint: colors.error, symbol: colors.error(symbols.large) };
    case "normal":
      return {
        paint: (text: string) => text,
        symbol: colors.muted(symbols.success),
      };
    case "warning":
      return { paint: colors.warning, symbol: colors.warning(symbols.warning) };
  }
};

const outDirOf = (files: readonly MeasuredFile[]) => {
  const [first] = files;
  if (first === undefined) return "";

  return first.displayPath.slice(
    0,
    first.displayPath.length - first.fileName.length - 1,
  );
};

const renderGroup = (
  ui: Ui,
  title: string,
  files: readonly MeasuredFile[],
  limit: number,
  showBrotli: boolean,
) => {
  if (files.length === 0) return;

  const sorted = [...files].sort((a, b) => b.size - a.size);
  // A server bundle is reported by its entry and its largest files: the
  // thousands of route chunks in it are never downloaded by anyone.
  const shown = ui.verbose
    ? sorted
    : files[0].category === "server"
      ? [
          ...sorted.filter(file => file.isEntry),
          ...sorted.filter(file => !file.isEntry),
        ].slice(0, limit)
      : sorted.slice(0, limit);
  const compressed = files.some(file => file.gzip !== null);

  ui.section(`${title}  ${ui.colors.muted(outDirOf(files))}`);
  ui.table({
    columns: [
      { header: "File" },
      { align: "right", header: "Size" },
      ...(compressed ? [{ align: "right" as const, header: "gzip" }] : []),
      ...(compressed && showBrotli
        ? [{ align: "right" as const, header: "brotli" }]
        : []),
    ],
    rows: shown.map(file => {
      const style = severityStyle(ui, classifySize(file.category, file.size));

      return [
        `${style.symbol} ${file.fileName}`,
        style.paint(formatBytes(file.size)),
        ...(compressed
          ? [ui.colors.muted(file.gzip === null ? "-" : formatBytes(file.gzip))]
          : []),
        ...(compressed && showBrotli
          ? [
              ui.colors.muted(
                file.brotli === null ? "-" : formatBytes(file.brotli),
              ),
            ]
          : []),
      ];
    }),
  });

  const hidden = files.length - shown.length;
  const totals = [
    `${plural(files.length, "file")}, ${formatBytes(sum(files.map(f => f.size)))}`,
    ...(compressed
      ? [`gzip ${formatBytes(sum(files.map(f => f.gzip ?? 0)))}`]
      : []),
  ].join(", ");

  ui.note(
    hidden > 0
      ? `… ${String(hidden)} more not shown (--verbose lists all) - ${totals}`
      : `Total: ${totals}`,
  );
};

export const renderOutput = (
  ui: Ui,
  files: readonly MeasuredFile[],
  { brotli }: { brotli: boolean },
) => {
  for (const group of GROUPS) {
    renderGroup(
      ui,
      group.title,
      files.filter(file => file.category === group.category),
      group.limit,
      brotli,
    );
  }
};

export const renderComparison = (ui: Ui, comparison: SnapshotComparison) => {
  const rows = [
    ...comparison.changed,
    ...comparison.added,
    ...comparison.removed,
  ]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, ui.verbose ? undefined : 10);

  ui.section("Bundle changes");

  if (rows.length === 0) {
    ui.note("No size changes since the previous build.");

    return;
  }

  ui.table({
    columns: [
      { header: "File" },
      { align: "right", header: "Size" },
      { align: "right", header: "Change" },
      { align: "right", header: "" },
      { header: "" },
    ],
    rows: rows.map(change => {
      const paint = change.delta > 0 ? ui.colors.warning : ui.colors.success;
      const status =
        change.before === 0
          ? ui.colors.muted("new")
          : change.after === 0
            ? ui.colors.muted("removed")
            : isNotableGrowth(change)
              ? ui.colors.error(ui.symbols.large)
              : "";

      return [
        change.file,
        formatBytes(change.after),
        paint(formatByteDelta(change.delta)),
        change.before === 0 || change.after === 0
          ? ""
          : paint(formatPercentDelta(change.ratio)),
        status,
      ];
    }),
  });

  const js = comparison.totals["client-js"];
  if (js !== undefined && js.before !== js.after) {
    ui.note(
      `Client JS total ${formatBytes(js.after)} (${formatByteDelta(js.after - js.before)})`,
    );
  }
};

export const renderAnalysis = (
  ui: Ui,
  analyses: null | readonly ChunkAnalysis[],
) => {
  ui.section("Bundle analysis");

  if (analyses === null || analyses.length === 0) {
    ui.note(
      "Unavailable: the bundler reported no module information for this build.",
    );

    return;
  }

  for (const analysis of analyses) {
    ui.line();
    ui.line(
      `${ui.mode === "plain" ? "" : "  "}${ui.colors.bold(analysis.file.fileName)}  ${formatBytes(analysis.file.size)}`,
    );

    const entries = [
      ...analysis.contributions,
      ...(analysis.other === null ? [] : [analysis.other]),
    ];
    const width = Math.max(...entries.map(entry => entry.label.length));

    entries.forEach(entry => {
      ui.line(
        `${ui.mode === "plain" ? "  " : "    "}${padEnd(entry.label, width)}   ${padStart(`≈ ${formatBytes(entry.size)}`, 12)}   ${ui.colors.muted(padStart(formatPercent(entry.share), 6))}`,
      );
    });
  }

  ui.line();
  ui.note(
    "Shares come from the bundler's per-module sizes before minification; sizes are that share of the file on disk.",
  );
};

export const renderWarnings = (ui: Ui, warnings: readonly BuildWarning[]) => {
  if (warnings.length === 0) return;

  ui.section("Warnings");

  for (const warning of warnings) {
    const style = severityStyle(ui, warning.severity);

    if (ui.mode === "plain") {
      ui.line(`[WARN] ${warning.title}`);
      warning.files.forEach(file => {
        ui.line(`  ${file.name} ${formatBytes(file.size)}`);
      });
      warning.suggestions.forEach(suggestion => {
        ui.line(`  - ${suggestion}`);
      });
      continue;
    }

    ui.line(`${style.symbol} ${warning.title}`);
    warning.files.forEach(file => {
      ui.line(`    ${file.name}  ${style.paint(formatBytes(file.size))}`);
    });
    ui.line(`  ${ui.colors.muted("Consider:")}`);
    warning.suggestions.forEach(suggestion => {
      ui.line(`  ${ui.colors.muted(ui.symbols.bullet)} ${suggestion}`);
    });
    ui.line();
  }

  ui.note("Size warnings are recommendations - they never fail a build.");
};

const ROUTE_CHILD_LIMIT = 6;

const ADMIN_PREFIX = "/admin";

const isAdminRoute = (route: BuildRoute) =>
  route.path === ADMIN_PREFIX || route.path.startsWith(`${ADMIN_PREFIX}/`);

const RENDERING_LABEL: Record<RouteMode, string> = {
  dynamic: "SSR",
  partial: "Partial",
  static: "Static",
};

interface RouteLine {
  /** Concrete URLs written at build time. */
  children: string[];
  detail?: string;
  /** Other locales' patterns this route answers to. */
  localized: string[];
  route: BuildRoute;
}

const routeLines = (ui: Ui, routes: readonly BuildRoute[]): RouteLine[] => {
  const collapsed = new Set(
    ui.verbose
      ? []
      : routes.filter(
          route =>
            isAdminRoute(route) &&
            route.mode === "dynamic" &&
            route.cache?.policy == null,
        ),
  );
  const lines: RouteLine[] = routes
    .filter(route => !collapsed.has(route))
    .map(route => ({
      children:
        route.staticPaths.length === 1 && route.staticPaths[0] === route.path
          ? []
          : route.staticPaths,
      localized: route.localizedPaths ?? [],
      route,
    }));

  if (collapsed.size > 0) {
    lines.push({
      children: [],
      detail: `${plural(collapsed.size, "AdminCP route")} (--verbose lists all)`,
      localized: [],
      route: { mode: "dynamic", path: `${ADMIN_PREFIX}/*`, staticPaths: [] },
    });
  }

  return lines.sort((a, b) => (a.route.path < b.route.path ? -1 : 1));
};

/** What serves this route's HTML, in the words the docs use. */
const pageCacheCell = (ui: Ui, route: BuildRoute): string => {
  const { cache, mode, staticPaths } = route;
  const override = cache?.source === "host" ? ui.colors.muted(" (app)") : "";
  const policy = cache?.policy ?? null;

  if (mode === "static") return ui.colors.success("Build-time HTML");

  const ssr =
    policy === null
      ? `None${cache?.source === "host" ? ui.colors.muted(" (disabled by app)") : ""}`
      : `${ui.colors.info(formatPageCachePolicy(policy))}${override}`;

  if (mode === "partial") {
    return `${ui.colors.success(`Build-time HTML × ${String(staticPaths.length)}`)}${ui.colors.muted(", others: ")}${ssr}`;
  }

  return ssr;
};

const renderingCell = (ui: Ui, route: BuildRoute): string => {
  const label = RENDERING_LABEL[route.mode];

  if (route.mode === "static") return ui.colors.success(label);
  if (route.cache?.policy != null) return ui.colors.info(label);

  return label;
};

const STORAGE_NOTES: Record<PageCacheStorageKind, string> = {
  memory:
    "Page cache storage: memory - one copy per server process, emptied on restart.",
  redis:
    "Page cache storage: Redis at REDIS_URL - connected when the server starts (runtime-dependent).",
};

/**
 * The route summary of `vitnode build`: how each page is rendered and whether
 * its HTML is reused. It reports the configured policy - never cache hits.
 */
export const renderRoutes = (
  ui: Ui,
  { pageCacheServed, pageCacheStorage, routes }: BuildRouteReport,
) => {
  if (routes.length === 0) return;

  const { corner, tee } = ui.symbols;
  const lines = routeLines(ui, routes);
  const indent = ui.mode === "plain" ? "" : "  ";

  ui.section("Routes");

  const rows = lines.flatMap(line => {
    const detail =
      line.detail === undefined ? "" : `  ${ui.colors.muted(line.detail)}`;
    const shown = ui.verbose
      ? line.children
      : line.children.slice(0, ROUTE_CHILD_LIMIT);
    const hidden = line.children.length - shown.length;
    const children: [string, string][] = [
      ...line.localized.map((path): [string, string] => [path, "pattern"]),
      ...shown.map((path): [string, string] => [path, "prerendered"]),
      ...(hidden > 0
        ? [[`… ${plural(hidden, "more URL")}`, ""] as [string, string]]
        : []),
    ];

    return [
      [
        `${line.route.path}${detail}`,
        renderingCell(ui, line.route),
        pageCacheCell(ui, line.route),
      ],
      ...children.map(([path, kind], index) => [
        `${ui.colors.muted(index === children.length - 1 ? corner : tee)} ${ui.colors.muted(path)}`,
        ui.colors.muted(kind),
        "",
      ]),
    ];
  });

  ui.table({
    columns: [
      { header: "Route" },
      { header: "Rendering" },
      { header: "Page cache" },
    ],
    rows,
  });

  ui.line();
  ui.line(
    `${indent}${ui.colors.success("Static")}          ${ui.colors.muted("HTML written at build time; a route with parameters lists the URLs it generated")}`,
  );
  ui.line(
    `${indent}${ui.colors.info("SSR, cached")}     ${ui.colors.muted("rendered on request, then reused for every visitor (TTL, then SWR window)")}`,
  );
  ui.line(
    `${indent}SSR, uncached   ${ui.colors.muted("rendered on request for each visitor")}`,
  );

  const hasCachedRoute = routes.some(route => route.cache?.policy != null);
  const hasDeclaredPolicy = routes.some(route => route.cache != null);

  if (hasCachedRoute && !pageCacheServed) {
    ui.line();
    ui.warning(
      "Routes declare a page cache policy, but src/server.ts does not wrap the server with withPageCache - nothing is cached until it does.",
    );
  } else if (hasCachedRoute && pageCacheStorage !== null) {
    ui.line();
    ui.note(STORAGE_NOTES[pageCacheStorage]);
  } else if (hasDeclaredPolicy && pageCacheStorage === null) {
    ui.line();
    ui.note("Page cache: off (vitNodeConfig.pageCache.enabled is false).");
  }
};
