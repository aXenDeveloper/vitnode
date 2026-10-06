import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import type { Project } from "../project/project";
import type { Ui } from "../ui/ui";
import type { MeasuredFile } from "./output-files";

import { writePluginApiRegistry } from "../../write-plugin-api-registry";
import { RuntimeError } from "../errors";
import { resolveBin } from "../project/packages";
import { runProcess } from "../project/processes";
import { toDisplayPath } from "../ui/format";

export interface CompilerStep {
  args: string[];
  /** The package whose executable runs this step, e.g. `typescript`. */
  bin: { name: string; package: string };
  label: string;
}

/**
 * A plugin package's build: the three compilers it has always used, in order.
 *
 * Types first (`tsc` emits declarations only), then the JavaScript (`swc`,
 * which also copies locale JSON into `dist`), then `tsc-alias` rewriting the
 * `@/` imports both of them left behind.
 */
export const packageBuildSteps = (): CompilerStep[] => [
  {
    args: ["-p", "tsconfig.build.json"],
    bin: { name: "tsc", package: "typescript" },
    label: "Emitting type declarations",
  },
  {
    args: ["src", "-d", "dist", "--config-file", ".swcrc", "--copy-files"],
    bin: { name: "swc", package: "@swc/cli" },
    label: "Compiling sources",
  },
  {
    args: ["-p", "tsconfig.build.json"],
    bin: { name: "tsc-alias", package: "tsc-alias" },
    label: "Rewriting path aliases",
  },
];

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
    const { code, output } = await runStep(step, project);

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
    task.succeed();
  }
};

/** Writes `types/api-registry.gen.d.ts` before `tsc` needs it. */
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
