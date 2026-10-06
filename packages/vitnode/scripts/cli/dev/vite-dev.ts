import type { InlineConfig, Plugin, ViteDevServer } from "vite";

import { relative } from "node:path";

import type { SignalSource } from "../project/processes";
import type { Project } from "../project/project";
import type { Ui } from "../ui/ui";

import { errorMessage, EXIT_CODE, RuntimeError } from "../errors";
import { importFromProject } from "../project/packages";
import { waitForShutdownSignal } from "../project/processes";
import { toDisplayPath } from "../ui/format";
import {
  formatHotUpdate,
  formatRequest,
  shouldLogRequest,
} from "./request-log";

export interface ViteDevApi {
  createServer: (config: InlineConfig) => Promise<ViteDevServer>;
}

/** The port a VitNode app uses when nothing else says otherwise. */
export const DEFAULT_DEV_PORT = 3000;

/**
 * The CLI's view into the dev server: request lines and HMR updates.
 *
 * It only observes. The middleware calls `next()` straight away and logs once
 * the response has finished; `hotUpdate` returns nothing, so Vite's own
 * update handling is untouched.
 */
export const createDevReporter = (
  ui: Ui,
  { defaultPort, root }: { defaultPort: null | number; root: string },
): Plugin => ({
  apply: "serve",
  // First in line, so its middleware sees every request before a framework
  // middleware answers it and never calls `next()`.
  enforce: "pre",
  name: "vitnode:dev-reporter",

  config: userConfig =>
    defaultPort !== null && userConfig.server?.port === undefined
      ? { server: { port: defaultPort } }
      : undefined,

  configureServer: server => {
    server.middlewares.use((req, res, next) => {
      const startedAt = performance.now();
      const request = {
        accept: req.headers.accept,
        method: req.method ?? "GET",
        url: req.url ?? "/",
      };

      if (shouldLogRequest(request)) {
        res.once("finish", () => {
          ui.line(
            formatRequest(ui, {
              durationMs: performance.now() - startedAt,
              method: request.method,
              status: res.statusCode,
              url: request.url,
            }),
          );
        });
      }
      next();
    });
  },

  hotUpdate(this: { environment?: { name: string } }, { file, modules }) {
    if (this.environment?.name !== "client" || modules.length === 0) return;
    if (/\.gen\.[cm]?[jt]sx?$/.test(file)) return;

    ui.line(formatHotUpdate(ui, toDisplayPath(relative(root, file))));
  },
});

export interface ViteDevOptions {
  host?: boolean | string;
  loadVite?: () => Promise<ViteDevApi>;
  openUrl: (url: string) => void;
  port?: number;
  project: Project;
  signals: SignalSource;
  ui: Ui;
}

/**
 * `vite dev` for a VitNode app, through Vite's JavaScript API - the app's own
 * config, the app's own Vite, one server. Owning the server object is what
 * gives VitNode a clean lifecycle: the URLs it prints are the ones Vite
 * actually bound, and Ctrl+C closes the server (and every environment and
 * watcher it started) before the process exits.
 */
export const runViteDev = async ({
  host,
  loadVite,
  openUrl,
  port,
  project,
  signals,
  ui,
}: ViteDevOptions): Promise<number> => {
  const vite = await (
    loadVite ??
    (async () => importFromProject<ViteDevApi>(project.root, "vite"))
  )();

  let server: ViteDevServer;
  try {
    server = await ui.runTask("Starting dev server", async () => {
      const created = await vite.createServer({
        clearScreen: false,
        configFile: project.viteConfig ?? undefined,
        logLevel: ui.verbose ? "info" : "warn",
        mode: "development",
        plugins: [
          createDevReporter(ui, {
            defaultPort: port === undefined ? DEFAULT_DEV_PORT : null,
            root: project.root,
          }),
        ],
        root: project.root,
        server: {
          ...(port === undefined ? {} : { port }),
          ...(host === undefined ? {} : { host }),
        },
      });

      try {
        await created.listen();
      } catch (error) {
        await created.close().catch(() => undefined);
        throw error;
      }

      return created;
    });
  } catch (error) {
    throw new RuntimeError("Could not start the dev server.", {
      cause: error,
      details: [errorMessage(error)],
    });
  }

  const base = (
    server.resolvedUrls?.local[0] ??
    `http://localhost:${String(server.config.server.port)}/`
  ).replace(/\/$/, "");
  const network = server.resolvedUrls?.network[0]?.replace(/\/$/, "");

  ui.line();
  ui.keyValue([
    ["Web", ui.colors.command(base)],
    ["AdminCP", ui.colors.command(`${base}/admin`)],
    ...(project.hasApi
      ? [["API", ui.colors.command(`${base}/api`)] as const]
      : []),
    ...(network === undefined
      ? []
      : [["Network", ui.colors.command(network)] as const]),
  ]);
  ui.rule();

  if (ui.interactive) {
    server.bindCLIShortcuts({
      customShortcuts: [
        {
          action: () => {
            openUrl(`${base}/admin`);
          },
          description: "open AdminCP",
          key: "a",
        },
      ],
      print: true,
    });
  }

  await waitForShutdownSignal(signals);
  ui.line();
  ui.note("Stopping the dev server...");
  await server.close();

  return EXIT_CODE.ok;
};
