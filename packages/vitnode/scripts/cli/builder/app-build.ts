import type { InlineConfig, Logger } from "vite";

import type { Project } from "../project/project";
import type { OutputCapture } from "../ui/capture-output";
import type { TaskHandle, Ui } from "../ui/ui";
import type { EnvironmentInfo } from "./collector";
import type { MeasuredFile } from "./output-files";
import type { BuildRoute } from "./routes";

import { isPluginPackage } from "../plugins/discover";
import { importFromProject, readPackageJson } from "../project/packages";
import { captureProcessOutput } from "../ui/capture-output";
import { createBuildCollector } from "./collector";
import { describeBuildError } from "./error-context";
import { measureFiles } from "./measure";
import { createPackageOwner } from "./package-owner";
import { htmlPathsUnder, routeReportApiOf } from "./routes";

/** The slice of Vite's JavaScript API a build needs. */
export interface ViteBuildApi {
  createBuilder: (config: InlineConfig) => Promise<{
    buildApp: () => Promise<unknown>;
    config: { plugins: readonly { api?: unknown; name: string }[] };
  }>;
}

export interface AppBuildOptions {
  analyze: boolean;
  /** Overridable so tests can stand in for console interception. */
  captureOutput?: () => OutputCapture;
  loadVite?: () => Promise<ViteBuildApi>;
  project: Project;
  ui: Ui;
}

export interface AppBuildResult {
  /** Warnings Vite and its plugins logged, held back unless `--verbose`. */
  bundlerWarnings: string[];
  /** Environments that wrote what ships, in build order. */
  environments: string[];
  files: MeasuredFile[];
  reportRoutes: (() => BuildRoute[]) | null;
}

const ENVIRONMENT_LABELS: Record<string, string> = {
  client: "Building client",
  nitro: "Packaging server (Nitro)",
  ssr: "Building server",
};

export const labelForEnvironment = ({ consumer, name }: EnvironmentInfo) =>
  ENVIRONMENT_LABELS[name] ??
  `Building ${name}${consumer === "server" ? " (server)" : ""}`;

/**
 * A logger for Vite that keeps warnings instead of printing them, so they can
 * be counted after the progress lines rather than tearing through them.
 */
const createQuietLogger = (warnings: string[]): Logger => {
  const warned = new Set<string>();

  return {
    clearScreen: () => undefined,
    error: message => {
      warnings.push(message);
    },
    hasErrorLogged: () => false,
    hasWarned: false,
    info: () => undefined,
    warn: message => {
      warnings.push(message);
    },
    warnOnce: message => {
      if (warned.has(message)) return;
      warned.add(message);
      warnings.push(message);
    },
  };
};

/**
 * `vite build` for a VitNode app, through Vite's own JavaScript API.
 *
 * The app's `vite.config.ts` is loaded exactly as `vite build` loads it - same
 * plugins, same environments, same `builder.buildApp` - with one observer
 * added, so the progress shown is the real sequence of environments this app
 * builds (for a TanStack Start + Nitro app: client, SSR, then Nitro's server
 * output). Generating plugin routes and registries happens inside that config,
 * in VitNode's own Vite plugin, which is why it is part of "Loading
 * configuration" rather than a step of its own.
 */
export const runAppBuild = async ({
  analyze,
  captureOutput = captureProcessOutput,
  loadVite = async () => importFromProject<ViteBuildApi>(project.root, "vite"),
  project,
  ui,
}: AppBuildOptions): Promise<AppBuildResult> => {
  const vite = await loadVite();
  const tasks = new Map<string, TaskHandle>();
  const bundlerWarnings: string[] = [];

  const collector = createBuildCollector(project.root, {
    onEnd: (environment, error) => {
      const task = tasks.get(environment.name);
      if (error === undefined) task?.succeed();
      else task?.fail();
    },
    onStart: environment => {
      tasks.set(environment.name, ui.task(labelForEnvironment(environment)));
    },
  });

  const capture = ui.verbose ? null : captureOutput();
  const configTask = ui.task("Loading configuration");
  let routeReportApi: ReturnType<typeof routeReportApiOf> = null;

  try {
    const builder = await vite.createBuilder({
      build: { reportCompressedSize: false },
      configFile: project.viteConfig ?? undefined,
      customLogger: ui.verbose ? undefined : createQuietLogger(bundlerWarnings),
      logLevel: ui.verbose ? "info" : "warn",
      mode: "production",
      plugins: [collector.plugin],
      root: project.root,
    });
    const generatesRoutes = builder.config.plugins.some(
      plugin => plugin.name === "vitnode:plugin-routes",
    );
    configTask.succeed(
      generatesRoutes
        ? "Configuration loaded, plugin routes generated"
        : "Configuration loaded",
    );

    routeReportApi = routeReportApiOf(builder.config.plugins);

    await builder.buildApp();
  } catch (error) {
    configTask.fail();
    tasks.forEach(task => {
      task.fail();
    });
    const captured = capture?.restore() ?? "";

    const owner = createPackageOwner(project.root);
    throw describeBuildError(error, {
      output: captured,
      pluginOf: file => {
        const dir = owner.rootOf(file);

        return dir === null || dir === project.root || !isPluginPackage(dir)
          ? null
          : (readPackageJson(dir)?.name ?? null);
      },
      root: project.root,
    });
  } finally {
    capture?.restore();
  }

  const shipped = [...collector.environments.values()].filter(
    environment => !environment.intermediate,
  );

  const files = await ui.runTask("Measuring output", async () =>
    measureFiles(
      shipped.flatMap(environment => environment.files),
      // Enough for every group the report lists without --verbose.
      { brotli: analyze ? 25 : 0 },
    ),
  );

  const publicDir = shipped.find(
    environment => environment.consumer === "client",
  )?.outDir;

  return {
    bundlerWarnings,
    environments: shipped.map(environment => environment.name),
    files,
    reportRoutes:
      routeReportApi === null || publicDir == null
        ? null
        : () => routeReportApi.routeReport(htmlPathsUnder(publicDir)),
  };
};
