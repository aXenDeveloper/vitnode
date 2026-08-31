import type { Plugin } from "vite";

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { sep } from "node:path";

import type { VitNodePluginRoutesOptions } from "./registries";

import { createGenerationQueue } from "./generation-queue";
import {
  vitNodeConfigPath,
  vitNodeGeneratedRegistries,
  vitNodeHostRoutesDir,
} from "./registries";

export type { VitNodePluginRoutesOptions };

/**
 * Writes a generated file, and only if it changed.
 *
 * The write-if-changed is load bearing, not an optimisation: these files live in
 * `src/`, so rewriting identical bytes on every dev-server event would trip
 * Vite's watcher and reload the page in a loop - the same trap two route
 * generators writing `routeTree.gen.ts` fall into.
 */
const writeIfChanged = async (path: string, source: string): Promise<void> => {
  const current = existsSync(path) ? await readFile(path, "utf8") : null;

  if (current !== source) await writeFile(path, source, "utf8");
};

/**
 * All four generated files, from one discovery pass.
 *
 * The whole of the writing half, and deliberately this short: what belongs in
 * each file is `./registries.ts`' decision, the destinations are its table, and
 * nothing here may add a fifth path or a different kind of output. A generated
 * file's location cannot be assembled at a call site, which is what
 * `no-materialized-routes.test.ts` reads this for.
 */
const writeGenerated = async (
  options: VitNodePluginRoutesOptions,
  onLoaded?: (watch: string[]) => void,
): Promise<void> => {
  const files = await vitNodeGeneratedRegistries(options, onLoaded);

  await Promise.all(
    files.map(async file => {
      await writeIfChanged(file.path, file.source);
    }),
  );
};

/**
 * Build-time discovery of the route modules an app's plugins ship -
 * `@vitnode/core/framework/vite`.
 *
 * The boundary this plugin exists to draw:
 *
 * - **Here, at build time.** Read the configured plugins, load their route
 *   manifests from `node_modules`, check every entry resolves to a real file,
 *   validate every route, reject two plugins claiming one URL and a plugin
 *   claiming one of the app's own, then write `src/plugin-route-manifest.gen.ts`
 *   and `src/plugin-routes.gen.ts` - and, from the same configured plugin list,
 *   `src/admin-nav.gen.ts` and `src/content-registry.gen.ts`, one literal import
 *   per plugin that exports an `admin/nav` or an `admin/content` module.
 * - **In the browser.** Import those four files. They contain literal data,
 *   literal `import()` calls and literal specifiers and nothing else - no
 *   `node:fs`, no package resolution, no validation to repeat and no specifier
 *   built from a variable, and so nothing a bundler cannot follow.
 *
 * Routes and navigation are discovered in one pass and stay separate concepts:
 * no generated file is derived from another, and a plugin may have a sidebar
 * entry with no route, a route with no entry, or both.
 *
 * Nothing is copied. The plugin's page stays in the plugin, compiled in its own
 * `dist`, and the app holds one generated line of registration per route.
 *
 * Everything about this is the same for every VitNode app on Vite, which is why
 * it ships here rather than being a file each one keeps a copy of. The only
 * thing an application supplies is where it lives.
 *
 * ## This is the only writer, and it is the only generator entry point
 *
 * Worth saying because it has not always been true and because the alternatives
 * are all tempting. There is no `vitnode generate` command, no `postinstall`
 * hook and no prebuild script that writes these files: an app that runs
 * `vite dev` or `vite build` has them, and an app that runs neither has no use
 * for them. `tanstackStart()` owns `src/routeTree.gen.ts` and this plugin never
 * touches it - two generators over one file is an infinite reload loop, which is
 * also why the app's `server.strictPort` matters.
 *
 * What the pass *contains* is `./registries.ts`, so a caller that wants the
 * bytes without a build - a determinism or staleness test - asks that one
 * directly rather than reimplementing this.
 */
export const vitNodePluginRoutes = (
  options: VitNodePluginRoutesOptions,
): Plugin => {
  const { appRoot } = options;
  const configPath = vitNodeConfigPath(appRoot);
  const routesDir = vitNodeHostRoutesDir(appRoot, options.hostRoutesDir);

  return {
    config: async () => {
      await writeGenerated(options);
    },
    /**
     * Regenerates while the dev server runs, so editing a plugin's manifest is
     * enough. Adding or removing a plugin in `vitnode.config.ts` is picked up
     * too, and so is adding one of the app's own route files - which is the
     * event that can turn a legal plugin route into a collision.
     *
     * A manifest that did not exist when the server started is not watched,
     * because there is no file to watch yet; restart for that, exactly as
     * installing a plugin already requires. A manifest that existed and was
     * *replaced* - which is what rebuilding a plugin does to its `dist` - is,
     * because a file this pass has ever read stays watched even after it is
     * deleted.
     *
     * A plugin's route *module* is not in that list and must not be: it is a
     * file the app already imports through the generated registry, so editing it
     * is Vite's own module graph doing its job - `swc -w` writes the page, the
     * server sees a module it depends on change, the page reloads, and no
     * registry needs rewriting because the bytes describing it did not change.
     * The same is true of an `admin/nav` or `admin/content` module: the generated
     * file holds a specifier, not the declarations, so its contents can change
     * freely without a regeneration. They are watched anyway, because a plugin
     * *gaining* such a module while the server runs does change the generated
     * bytes.
     */
    configureServer: server => {
      const watched = new Set<string>([configPath]);

      /**
       * The regeneration chain, and the one pass allowed to be waiting on it.
       *
       * Regeneration is asynchronous - it resolves several manifests and writes
       * four files - and the watcher can fire many times before the first pass
       * finishes. Run concurrently, two passes interleave and the *older* one can
       * perform the last write, leaving generated files that describe a manifest
       * that no longer exists until something else happens to touch it.
       *
       * `createGenerationQueue` is that rule and only that rule: passes are
       * chained rather than parallel, and at most one is queued behind the
       * running one, because a pass re-reads everything from disk when it starts
       * and so the queued one sees the final state whether it was asked for once
       * or forty times. That is what keeps a `dist` rebuild - which rewrites
       * every file a plugin has - from queueing a pass per file. See
       * `./generation-queue.ts`, where it is stated without a dev server so it
       * can be tested.
       */
      const queue = createGenerationQueue(
        async () =>
          writeGenerated(options, files => {
            files.forEach(file => watched.add(file));
            server.watcher.add(files);
          }),
        error => {
          server.config.logger.error(String(error));
        },
      );

      /**
       * Whether a file this pass sees can change what the generated files say.
       *
       * The config and any manifest ever read, for the obvious reason. Route
       * *files* of the app only by their existence - a route file's contents
       * cannot move the URL it claims, which is in its name - so a change to one
       * is ignored and an add or a delete is not.
       */
      const isRelevant = (file: string, existenceOnly: boolean): boolean => {
        if (watched.has(file)) return true;
        if (!existenceOnly || routesDir === null) return false;

        return (
          file.startsWith(`${routesDir}${sep}`) && /\.[cm]?[jt]sx?$/.test(file)
        );
      };

      const onExistenceChange = (file: string) => {
        if (isRelevant(file, true)) queue.request();
      };

      server.watcher.add(configPath);
      queue.request();
      server.watcher.on("add", onExistenceChange);
      server.watcher.on("unlink", onExistenceChange);
      server.watcher.on("change", file => {
        if (isRelevant(file, false)) queue.request();
      });
    },
    name: "vitnode:plugin-routes",
  };
};
