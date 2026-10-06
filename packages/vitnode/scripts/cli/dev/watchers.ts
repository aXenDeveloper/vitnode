import { join } from "node:path";

import type { RunProcessOptions, SignalSource } from "../project/processes";
import type { Project } from "../project/project";
import type { Runtime } from "../project/runtime";
import type { Ui } from "../ui/ui";

import { EXIT_CODE, RuntimeError } from "../errors";
import { resolveBin } from "../project/packages";
import { ProcessGroup, waitForShutdownSignal } from "../project/processes";
import { runtimeExecutable } from "../project/runtime";

export interface Watcher {
  args: string[];
  /** The package executable to run, or `null` to run the runtime itself. */
  bin: null | { name: string; package: string };
}

/** The plugin package's three compilers, each in watch mode. */
export const packageWatchers = (): Watcher[] => [
  {
    args: ["-w", "-p", "tsconfig.build.json", "--preserveWatchOutput"],
    bin: { name: "tsc", package: "typescript" },
  },
  {
    args: [
      "src",
      "-d",
      "dist",
      "--config-file",
      ".swcrc",
      "--copy-files",
      "-w",
    ],
    bin: { name: "swc", package: "@swc/cli" },
  },
  {
    args: ["-w", "-p", "tsconfig.build.json"],
    bin: { name: "tsc-alias", package: "tsc-alias" },
  },
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
