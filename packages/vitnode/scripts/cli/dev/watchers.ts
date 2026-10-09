import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { RunProcessOptions, SignalSource } from "../project/processes";
import type { Project } from "../project/project";
import type { Runtime } from "../project/runtime";
import type { Ui } from "../ui/ui";

import { typeCheckStep } from "../builder/compiler-build";
import { EXIT_CODE, RuntimeError } from "../errors";
import { resolveBin } from "../project/packages";
import { ProcessGroup, waitForShutdownSignal } from "../project/processes";
import { runtimeExecutable } from "../project/runtime";

export interface Watcher {
  args: string[];
  /** The package executable to run, or `null` to run the runtime itself. */
  bin: null | { name: string; package: string };
}

/**
 * How to start the package watch runner: the built `package-watch.js` next to
 * the CLI bundle, or - when the CLI itself runs from TypeScript, as in its own
 * tests - the runner's source through tsx.
 */
export const packageWatchRunner = (): string[] => {
  const here = dirname(fileURLToPath(import.meta.url));
  const built = join(here, "package-watch.js");

  return existsSync(built)
    ? [built]
    : ["--import", "tsx", join(here, "..", "..", "package-watch.ts")];
};

/**
 * A plugin package in development: `tsc` reporting type errors, and tsdown
 * rebuilding `dist/src` as sources change - the JavaScript and the
 * declarations in a process each, so the JavaScript an app reloads never
 * waits for the TypeScript compiler.
 *
 * tsdown runs in child processes - the runner above - rather than in the CLI:
 * stopping the group then ends every watcher it started.
 */
export const packageWatchers = (): Watcher[] => [
  {
    args: typeCheckStep(true).args,
    bin: { name: "tsc", package: "typescript" },
  },
  { args: [...packageWatchRunner(), "javascript"], bin: null },
  { args: [...packageWatchRunner(), "declarations"], bin: null },
];

/**
 * A standalone API, restarted on every change: Bun reloads its TypeScript
 * entry itself (`bun --hot`), Node goes through `tsx watch`.
 */
export const apiWatchers = (runtime: Runtime): Watcher[] =>
  runtime === "bun"
    ? [{ args: ["--hot", join("src", "index.ts")], bin: null }]
    : [
        {
          args: ["watch", join("src", "index.ts")],
          bin: { name: "tsx", package: "tsx" },
        },
      ];

export const toProcess = (
  project: Project,
  watcher: Watcher,
  {
    env,
    runtime = "node",
  }: { env?: NodeJS.ProcessEnv; runtime?: Runtime } = {},
): RunProcessOptions =>
  // No bin: the runtime runs the entry itself. Otherwise a package's bin, run
  // by Node.
  watcher.bin === null
    ? {
        args: watcher.args,
        command: runtimeExecutable(runtime),
        cwd: project.root,
        env,
      }
    : {
        args: [
          resolveBin(project.root, watcher.bin.package, watcher.bin.name),
          ...watcher.args,
        ],
        command: process.execPath,
        cwd: project.root,
        env,
      };

/**
 * Runs long-lived watchers until one of them dies or the developer stops them.
 *
 * Every watcher is a direct child spawned without a shell, so stopping the
 * group reaches the real process - no `cmd.exe` or `sh` in between to orphan a
 * compiler when the parent goes away.
 */
export const runWatchers = async ({
  group = new ProcessGroup(),
  processes,
  signals,
  ui,
}: {
  group?: Pick<ProcessGroup, "firstExit" | "spawn" | "stop">;
  processes: readonly RunProcessOptions[];
  signals: SignalSource;
  ui: Ui;
}): Promise<number> => {
  processes.forEach(options => group.spawn(options));

  const outcome = await Promise.race([
    group.firstExit().then(code => ({ code, kind: "exit" as const })),
    waitForShutdownSignal(signals).then(() => ({
      code: 0,
      kind: "signal" as const,
    })),
  ]);

  ui.line();
  ui.note("Stopping...");
  await group.stop();

  if (outcome.kind === "exit" && outcome.code !== 0) {
    throw new RuntimeError(
      `A watcher exited with code ${String(outcome.code)}.`,
    );
  }

  return EXIT_CODE.ok;
};
