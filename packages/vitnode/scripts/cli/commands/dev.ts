import type { CommandContext, OutputOptions } from "../context";
import type { DatabaseServices } from "../db/database";
import type { ViteDevApi } from "../dev/vite-dev";
import type { LoadConfiguredPluginIds } from "../plugins/discover";
import type { ProcessGroup } from "../project/processes";
import type { Project } from "../project/project";

import { writePluginApiRegistry } from "../../write-plugin-api-registry";
import { createDatabaseServices } from "../db/database";
import { prepareDevelopmentDatabase } from "../db/prepare";
import { openUrl } from "../dev/open-url";
import { runViteDev } from "../dev/vite-dev";
import {
  apiWatchers,
  packageWatchers,
  runWatchers,
  toProcess,
} from "../dev/watchers";
import { loadConfiguredPluginIds } from "../plugins/discover";
import { resolveFromProject } from "../project/packages";
import { detectProject } from "../project/project";
import { detectRuntime } from "../project/runtime";
import { plural } from "../ui/format";
import { displayHost, parsePort } from "./start";

export interface DevOptions extends OutputOptions {
  host?: boolean | string;
  port?: string;
}

export interface DevDeps {
  database?: (root: string) => DatabaseServices;
  group?: Pick<ProcessGroup, "firstExit" | "spawn" | "stop">;
  loadIds?: LoadConfiguredPluginIds;
  loadVite?: () => Promise<ViteDevApi>;
  openUrl?: (url: string) => void;
}

const apiHost = (host: DevOptions["host"]): string | undefined =>
  host === true ? "0.0.0.0" : host === false ? undefined : host;

/** Whether `vitnode dev` should prepare this project's database first. */
const ownsDatabase = (project: Project) =>
  project.drizzleConfig !== null && project.hasApi;

/**
 * `vitnode dev` - the development environment for whatever this folder is.
 *
 * - An app: database bootstrap (when it owns the schema), then Vite.
 * - An API: database bootstrap, then `tsx watch`.
 * - A plugin package: tsdown and `tsc` in watch mode, so the apps importing
 *   its `dist` reload as it changes - what `vitnode dev` has always done there.
 */
export const runDevCommand = async (
  context: CommandContext,
  options: DevOptions,
  deps: DevDeps = {},
): Promise<number> => {
  const { env, platform, signals, ui } = context;
  const project = detectProject(context.cwd);

  if (project.kind === "package") {
    ui.header(`Plugin development - ${project.name}`);
    // The runner loads tsdown from the package; a missing install is a
    // configuration error here, not a watcher crashing a moment later.
    resolveFromProject(project.root, "tsdown");
    if (writePluginApiRegistry(project.root))
      ui.success("API registry generated");
    ui.info(
      "Watching sources - apps using this plugin reload as dist/ changes",
    );
    ui.line();

    return runWatchers({
      group: deps.group,
      processes: packageWatchers().map(watcher => toProcess(project, watcher)),
      signals,
      ui,
    });
  }

  ui.header("Development");

  const database = (deps.database ?? createDatabaseServices)(project.root);
  // The same loader the app's Vite plugin uses, so a broken plugin list fails
  // here with a message instead of halfway through the server start.
  const plugins =
    project.kind === "app"
      ? await ui.runTask("Loading configuration", async () =>
          (deps.loadIds ?? loadConfiguredPluginIds)(project.root),
        )
      : null;

  if (ownsDatabase(project)) await prepareDevelopmentDatabase(ui, database);
  if (plugins !== null)
    ui.success(`${plural(plugins.length, "plugin")} loaded`);

  if (project.kind === "api") {
    // The API reads PORT itself, so `--port` reaches it the same way.
    const port = parsePort(options.port ?? env.PORT, 8000);
    const host = apiHost(options.host) ?? env.HOST;
    const runtime = detectRuntime(project.root, env);
    ui.line();
    ui.keyValue([
      [
        "API",
        ui.colors.command(`http://${displayHost(host)}:${String(port)}/api`),
      ],
      [
        "Runtime",
        ui.colors.muted(runtime === "bun" ? "Bun (--hot)" : "Node (tsx watch)"),
      ],
    ]);
    ui.rule();

    return runWatchers({
      group: deps.group,
      processes: apiWatchers(runtime).map(watcher =>
        toProcess(project, watcher, {
          env: {
            ...env,
            PORT: String(port),
            ...(host === undefined ? {} : { HOST: host }),
          },
          runtime,
        }),
      ),
      signals,
      ui,
    });
  }

  return runViteDev({
    host: options.host,
    loadVite: deps.loadVite,
    openUrl:
      deps.openUrl ??
      (url => {
        openUrl(url, platform);
      }),
    port:
      options.port === undefined && env.PORT === undefined
        ? undefined
        : parsePort(options.port ?? env.PORT, 3000),
    project,
    signals,
    ui,
  });
};
