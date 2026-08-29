/**
 * The one place the two plugin routing paths can collide, and a warning for it.
 *
 * **Migration-only. Delete this file at the Next.js cutover**, together with
 * `prepare-plugins-files.ts`, which is the only thing that imports it, and with
 * `src/framework/plugin-routes/legacy-routes.ts`, which is the other half of
 * this problem: this warns about a plugin route *module* landing where the
 * copier will find it, that one refuses a plugin route *path* that a Next.js
 * page still answers. Nothing in `@vitnode/core/routing` or
 * `@vitnode/core/tanstack/*` knows either exists, and nothing in the TanStack
 * runtime depends on them - that separation is the point, not an accident.
 *
 * Stage 12 made this warning far more likely to fire, and worth reading twice:
 * a plugin may now declare `area: "admin"`, and the obvious place to put that
 * module is `src/routes/admin/` - which is precisely the directory the copier
 * claims. `routes/admin-reports` is free; `routes/admin/reports` is not.
 *
 * ## The collision
 *
 * A plugin's `src/routes/` now means two different things at once, because two
 * runtimes read it:
 *
 *     src/routes/main/page.tsx        legacy: COPIED into a Next app's src/app/
 *     src/routes/admin/…              legacy: copied into the AdminCP
 *     src/routes/blank/…              legacy: copied without the site chrome
 *     src/routes/breadcrumb/…         legacy: copied into a @breadcrumb slot
 *
 *     src/routes/manifest.ts          new: declares routes, never copied
 *     src/routes/example-page.tsx     new: imported from the plugin's own dist
 *
 * The two do not overlap today, because the copier only descends into those four
 * directory names and a manifest entry has never used one. But a plugin author
 * who groups new-style route modules under `routes/admin/` gets those files
 * copied into every Next app that installs the plugin - as stray files in a
 * generated directory nobody reads, discovered much later and traced back to
 * this copier by nobody.
 *
 * A warning rather than an error, deliberately: the legacy path has to keep
 * working exactly as it did, and a plugin that hits this is confusing rather
 * than broken.
 */

/**
 * The directory names the legacy copier claims inside a plugin's `src/routes/`.
 *
 * The same four `prepare-plugins-files.ts` builds its source list from. Kept
 * here as data so the rule can be checked without a filesystem, and so deleting
 * one of them is one edit rather than two.
 */
export const LEGACY_ROUTE_DIRECTORIES: readonly string[] = [
  "admin",
  "blank",
  "breadcrumb",
  "main",
];

/** One plugin's declared entries, as much of them as this rule reads. */
export interface LegacyOverlapInput {
  pluginId: string;
  routes?: readonly { entry?: unknown; id?: unknown }[];
}

export interface LegacyRouteOverlap {
  directory: string;
  entry: string;
  pluginId: string;
  routeId: string;
}

/**
 * Every manifest entry that lives under a directory the legacy copier claims.
 *
 * Pure, total and defensive about its input: it is handed plugin configuration
 * that was written by hand and is JavaScript by the time it gets here, and a
 * malformed entry is `buildPluginRouteManifest`'s to reject, not this warning's
 * to throw on.
 *
 * Matches whole segments, and only a `routes/<legacy>/…` shape. Three things
 * that all look similar and only one of which is a collision:
 *
 *     routes/main-page          a file called main-page - fine
 *     routes/main               a file called main.tsx, not the directory - fine
 *     routes/main/page          inside the directory the copier descends into
 */
export const legacyRouteOverlaps = (
  sources: readonly LegacyOverlapInput[],
): LegacyRouteOverlap[] =>
  sources.flatMap(source =>
    (source.routes ?? []).flatMap(route => {
      if (typeof route.entry !== "string") return [];

      const [root, directory, ...rest] = route.entry.split("/");

      if (root !== "routes") return [];
      if (!LEGACY_ROUTE_DIRECTORIES.includes(directory)) return [];
      // `routes/main` is a module called main, not something inside `main/`.
      if (rest.length === 0) return [];

      return [
        {
          directory,
          entry: route.entry,
          pluginId: source.pluginId,
          routeId: typeof route.id === "string" ? route.id : "",
        },
      ];
    }),
  );

/**
 * What to print for one overlap, or `null` when there is nothing to say.
 *
 * A string rather than a `console.warn` so the message is assertable without
 * capturing output, and so the caller decides where warnings go.
 */
export const legacyRouteOverlapWarning = (
  overlaps: readonly LegacyRouteOverlap[],
): null | string => {
  if (overlaps.length === 0) return null;

  const lines = overlaps.map(
    overlap =>
      `  ${overlap.pluginId} route "${overlap.routeId}" declares entry "${overlap.entry}"`,
  );

  return [
    "[VitNode] Plugin route entries under a directory the Next.js route copier claims:",
    ...lines,
    `  These files are also copied into every Next.js app that installs the plugin, because "src/routes/{${LEGACY_ROUTE_DIRECTORIES.join(", ")}}" is where a plugin's Next.js pages live during the migration.`,
    "  Move the module out of that directory - a route entry can be named anything else.",
  ].join("\n");
};
