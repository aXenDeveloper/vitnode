import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import type { Project } from "../project/project";
import type { TaskHandle, Ui } from "../ui/ui";
import type { MeasuredFile } from "./output-files";
import type { TsdownApi } from "./package-build";

import { writePluginApiRegistry } from "../../write-plugin-api-registry";
import { errorMessage, RuntimeError } from "../errors";
import { importFromProject, resolveBin } from "../project/packages";
import { runProcess } from "../project/processes";
import { captureProcessOutput } from "../ui/capture-output";
import { formatDuration, toDisplayPath } from "../ui/format";
import {
  createPackageLogger,
  PACKAGE_TSCONFIG,
  packageTsdownConfig,
} from "./package-build";

export interface CompilerStep {
  args: string[];
  /** The package whose executable runs this step, e.g. `typescript`. */
  bin: { name: string; package: string };
  label: string;
}

/**
 * A plugin package's type check: the full `tsc` program, without output.
 *
 * tsdown writes the JavaScript and the declarations, but its declaration step
 * emits each file without reporting type errors - so this is what still fails
 * the build on one, as `tsc` always did.
 */
export const typeCheckStep = (watch = false): CompilerStep => ({
  args: [
    "--noEmit",
    "-p",
    PACKAGE_TSCONFIG,
    ...(watch ? ["-w", "--preserveWatchOutput"] : []),
  ],
  bin: { name: "tsc", package: "typescript" },
  label: "Checking types",
});

/** A standalone API app's build: `tsc`, then `tsc-alias`. */
export const apiBuildSteps = (): CompilerStep[] => [
  {
    args: ["-p", "tsconfig.json"],
    bin: { name: "tsc", package: "typescript" },
    label: "Compiling TypeScript",
  },
  {
    args: ["-p", "tsconfig.json"],
    bin: { name: "tsc-alias", package: "tsc-alias" },
    label: "Rewriting path aliases",
  },
];

export type StepRunner = (
  step: CompilerStep,
  project: Project,
) => Promise<{ code: number; output: string }>;

export const runStepWithNode: StepRunner = async (step, project) =>
  runProcess({
    args: [
      resolveBin(project.root, step.bin.package, step.bin.name),
      ...step.args,
    ],
    capture: true,
    command: process.execPath,
    cwd: project.root,
  });

/** Ends a step's task, failing the build with the tool's output when it failed. */
const finishStep = (
  ui: Ui,
  task: TaskHandle,
  step: CompilerStep,
  { code, output }: { code: number; output: string },
  detail?: string,
) => {
  if (ui.verbose && output.trim() !== "") ui.line(output.trimEnd());

  if (code !== 0) {
    task.fail();
    throw new RuntimeError(
      `Build failed: ${step.bin.name} exited with code ${String(code)}`,
      {
        output: ui.verbose ? undefined : output,
      },
    );
  }
  task.succeed(undefined, detail);
};

export const runCompilerSteps = async ({
  project,
  runStep = runStepWithNode,
  steps,
  ui,
}: {
  project: Project;
  runStep?: StepRunner;
  steps: readonly CompilerStep[];
  ui: Ui;
}): Promise<void> => {
  for (const step of steps) {
    const task = ui.task(step.label);
    finishStep(ui, task, step, await runStep(step, project));
  }
};

export type LoadTsdown = (root: string) => Promise<TsdownApi>;

export const loadProjectTsdown: LoadTsdown = async root =>
  importFromProject<TsdownApi>(root, "tsdown");

/**
 * A plugin package's build: tsdown compiles `src` into `dist/src` - the
 * JavaScript and its declarations - while `tsc` checks the types alongside it.
 *
 * Both have to pass. They run at the same time because each is a full
 * TypeScript program over the same files, and neither needs the other's
 * output; the type check is awaited even when compiling fails, so no `tsc` is
 * ever left running.
 */
export const runPackageBuild = async ({
  loadTsdown = loadProjectTsdown,
  project,
  runStep = runStepWithNode,
  ui,
}: {
  loadTsdown?: LoadTsdown;
  project: Project;
  runStep?: StepRunner;
  ui: Ui;
}): Promise<void> => {
  const tsdown = await loadTsdown(project.root);
  const check = typeCheckStep();
  const startedAt = Date.now();
  const typeCheck = runStep(check, project).then(result => ({
    ...result,
    duration: Date.now() - startedAt,
  }));
  const warnings: string[] = [];
  const logger = createPackageLogger((type, message) => {
    if (type !== "info") warnings.push(message);
  });

  const compile = ui.task("Compiling sources");
  // Anything tsdown or a plugin prints straight to the console is held back,
  // and shown with the error if the build fails.
  const capture = ui.verbose ? null : captureProcessOutput();
  try {
    await tsdown.build(
      packageTsdownConfig({ logger, mode: "build", root: project.root }),
    );
  } catch (error) {
    const captured = capture?.restore() ?? "";
    compile.fail();
    await typeCheck.catch(() => undefined);
    throw new RuntimeError(
      "Build failed: tsdown could not compile the package",
      {
        cause: error,
        output: [captured.trimEnd(), ...warnings, errorMessage(error)]
          .filter(text => text !== "")
          .join("\n"),
      },
    );
  }
  const captured = capture?.restore() ?? "";
  compile.succeed();

  const checked = await typeCheck;
  finishStep(
    ui,
    ui.task(check.label),
    check,
    checked,
    formatDuration(checked.duration),
  );

  if (warnings.length > 0) {
    ui.line();
    warnings.forEach(warning => {
      ui.warning(warning);
    });
  }
  if (ui.verbose && captured.trim() !== "") ui.line(captured.trimEnd());
};

/** Writes `types/api-registry.gen.d.ts` before tsdown and `tsc` need it. */
export const prepareRegistryStep = (project: Project, ui: Ui) => {
  if (writePluginApiRegistry(project.root)) {
    ui.success("API registry generated");
  }
};

/** Every file under `dir`, as measured output, for the compiler builds. */
export const listOutput = (project: Project, dir: string): MeasuredFile[] => {
  const root = join(project.root, dir);
  const files: MeasuredFile[] = [];

  const walk = (current: string) => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(current, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        walk(path);
        continue;
      }
      if (entry.endsWith(".map")) continue;

      const fileName = toDisplayPath(relative(root, path));
      files.push({
        absolutePath: path,
        brotli: null,
        category: "server",
        consumer: "server",
        displayPath: toDisplayPath(relative(project.root, path)),
        environment: "dist",
        fileName,
        gzip: null,
        isEntry: fileName === "index.js" || fileName === "src/index.js",
        key: `dist:${fileName}`,
        modules: [],
        size: stats.size,
        type: "chunk",
      });
    }
  };

  walk(root);

  return files;
};
