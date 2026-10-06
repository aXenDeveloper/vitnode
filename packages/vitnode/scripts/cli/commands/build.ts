import type { AppBuildOptions } from "../builder/app-build";
import type { StepRunner } from "../builder/compiler-build";
import type { MeasuredFile } from "../builder/output-files";
import type { CommandContext, OutputOptions } from "../context";
import type { Project } from "../project/project";
import type { Ui } from "../ui/ui";

import { analyzeChunks } from "../builder/analysis";
import { runAppBuild } from "../builder/app-build";
import {
  apiBuildSteps,
  listOutput,
  packageBuildSteps,
  prepareRegistryStep,
  runCompilerSteps,
} from "../builder/compiler-build";
import { createPackageOwner } from "../builder/package-owner";
import {
  renderAnalysis,
  renderComparison,
  renderOutput,
  renderWarnings,
} from "../builder/report";
import {
  compareSnapshots,
  createSnapshot,
  readSnapshot,
  snapshotPathFor,
  writeSnapshot,
} from "../builder/snapshot";
import { collectWarnings } from "../builder/warnings";
import { errorMessage, EXIT_CODE } from "../errors";
import { isPluginPackage } from "../plugins/discover";
import { detectProject } from "../project/project";
import { detectRuntime } from "../project/runtime";
import { formatDuration, plural } from "../ui/format";

export interface BuildOptions extends OutputOptions {
  analyze?: boolean;
}

export interface BuildDeps {
  appBuild?: Partial<Pick<AppBuildOptions, "captureOutput" | "loadVite">>;
  now?: () => number;
  runStep?: StepRunner;
}

/**
 * Runs a reporting step that must never fail the build it reports on: a
 * corrupt snapshot or an analyzer surprise costs one section, not the build.
 */
const safely = <T>(ui: Ui, what: string, run: () => T): T | undefined => {
  try {
    return run();
  } catch (error) {
    ui.line();
    ui.note(`${what} skipped: ${errorMessage(error)}`);

    return undefined;
  }
};

const compareWithPrevious = (
  ui: Ui,
  project: Project,
  files: readonly MeasuredFile[],
) => {
  const path = snapshotPathFor(project.root);
  const previous = readSnapshot(path);
  const current = createSnapshot(files);

  if (previous.status === "ok")
    renderComparison(ui, compareSnapshots(previous.snapshot, current));
  if (previous.status === "corrupt") {
    ui.line();
    ui.note(
      "The previous build's size snapshot was unreadable - comparing from the next build on.",
    );
  }

  writeSnapshot(path, current);
};

const reportAppBuild = (
  ui: Ui,
  project: Project,
  files: readonly MeasuredFile[],
  {
    analyze,
    bundlerWarnings,
  }: { analyze: boolean; bundlerWarnings: readonly string[] },
) => {
  const analyses = analyze
    ? safely(ui, "Bundle analysis", () =>
        analyzeChunks(files, { owner: createPackageOwner(project.root) }),
      )
    : undefined;

  ui.section("Output");
  renderOutput(ui, files, { brotli: analyze });

  safely(ui, "Bundle comparison", () => {
    compareWithPrevious(ui, project, files);
  });

  if (analyze && analyses !== undefined) renderAnalysis(ui, analyses);

  renderWarnings(ui, collectWarnings(files, analyses ?? []));

  if (bundlerWarnings.length > 0 && !ui.verbose) {
    ui.line();
    ui.note(
      `${plural(bundlerWarnings.length, "bundler warning")} hidden - run with --verbose to see them.`,
    );
  }
};

export const runBuildCommand = async (
  { cwd, env, ui }: CommandContext,
  options: BuildOptions,
  deps: BuildDeps = {},
): Promise<number> => {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const project = detectProject(cwd);
  const analyze = options.analyze === true;

  if (project.kind === "package") {
    ui.header(`Building ${project.name}`);
    if (isPluginPackage(project.root)) prepareRegistryStep(project, ui);
    await runCompilerSteps({
      project,
      runStep: deps.runStep,
      steps: packageBuildSteps(),
      ui,
    });
  } else if (
    project.kind === "api" &&
    detectRuntime(project.root, env) === "bun"
  ) {
    // Bun runs the TypeScript entry as it is: there is no output to produce,
    // and `vitnode start` runs `src/index.ts` directly.
    ui.header("Production build");
    ui.success("Nothing to compile - Bun runs src/index.ts directly");
  } else if (project.kind === "api") {
    ui.header("Production build");
    await runCompilerSteps({
      project,
      runStep: deps.runStep,
      steps: apiBuildSteps(),
      ui,
    });
    ui.section("Output");
    renderOutput(ui, listOutput(project, "dist"), { brotli: false });
  } else {
    ui.header("Production build");
    const result = await runAppBuild({
      analyze,
      project,
      ui,
      ...deps.appBuild,
    });
    reportAppBuild(ui, project, result.files, {
      analyze,
      bundlerWarnings: result.bundlerWarnings,
    });
  }

  ui.line();
  ui.success(`Built in ${formatDuration(now() - startedAt)}`);
  if (project.kind !== "package") {
    ui.note(`Run ${ui.colors.command("vitnode start")} to serve it.`);
  }
  ui.line();

  return EXIT_CODE.ok;
};
