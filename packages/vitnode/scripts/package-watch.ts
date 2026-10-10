#!/usr/bin/env node
import color from "picocolors";

import type { PackageOutput, TsdownApi } from "./cli/builder/package-build.js";

import {
  createPackageLogger,
  watchPackage,
} from "./cli/builder/package-build.js";
import { errorMessage, isCliError } from "./cli/errors.js";
import { importFromProject } from "./cli/project/packages.js";

/**
 * `vitnode dev` in a plugin package runs this file as child processes: tsdown
 * in watch mode over the package in the working directory, for the output
 * named by the first argument.
 *
 * `javascript` is what an app reloads, rebuilt within milliseconds of a save;
 * `declarations` follow once the TypeScript compiler has caught up. They run
 * as two processes because the compiler blocks the thread it runs on - in one
 * process, every JavaScript rebuild would wait for the declarations.
 *
 * It runs until it is stopped. A compile error is printed and the next change
 * rebuilds; only a failure to start at all - tsdown missing, a broken
 * tsconfig - exits, with a non-zero code `vitnode dev` reports.
 */
const root = process.cwd();
const output: PackageOutput =
  process.argv[2] === "declarations" ? "declarations" : "javascript";

const label =
  color.cyan("tsdown") +
  color.dim(output === "declarations" ? " types" : " js   ");

const print = (type: "error" | "info" | "warn", message: string) => {
  if (type === "info") process.stdout.write(`${label} ${message}\n`);
  else if (type === "warn")
    process.stderr.write(`${label} ${color.yellow(message)}\n`);
  else process.stderr.write(`${label} ${color.red(message)}\n`);
};

try {
  const tsdown = await importFromProject<TsdownApi>(root, "tsdown");
  const watcher = await watchPackage({
    logger: createPackageLogger(print),
    output,
    root,
    tsdown,
  });

  const stop = () => {
    void watcher.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
} catch (error) {
  print("error", errorMessage(error));
  if (isCliError(error) && error.hint !== undefined) print("error", error.hint);
  process.exit(1);
}
