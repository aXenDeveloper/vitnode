import { CommanderError } from "commander";

import type { CliRuntime, OutputOptions } from "./context";
import type { Ui } from "./ui/ui";

import { createCommandContext, createCommandUi } from "./context";
import { EXIT_CODE, UserError } from "./errors";
import { renderRootHelp } from "./help";
import { createProgram } from "./program";
import { reportError } from "./report-error";

export type { CliRuntime } from "./context";

/** Commander's own exits that are not failures: help and version. */
const QUIET_EXITS = new Set([
  "commander.help",
  "commander.helpDisplayed",
  "commander.version",
]);

const fromCommanderError = (error: CommanderError): UserError =>
  new UserError(error.message.replace(/^error:\s*/i, ""), {
    hint: "Run vitnode --help to see every command, or vitnode <command> --help for its options.",
  });

/**
 * Runs one invocation and resolves with the exit code.
 *
 * Never calls `process.exit` and never throws - the entry point decides what
 * to do with the number, which is what lets the whole CLI run inside a test.
 */
export const runCli = async (
  argv: readonly string[],
  runtime: CliRuntime,
): Promise<number> => {
  // Read before parsing, so even a usage error is reported the way the
  // developer asked: plain in CI, with a stack trace under --verbose.
  const requested: OutputOptions = {
    plain: argv.includes("--plain"),
    verbose: argv.includes("--verbose") || runtime.env.VITNODE_DEBUG === "1",
  };
  let ui: Ui = createCommandUi(runtime, requested);
  let exitCode: number = EXIT_CODE.ok;

  if (argv.length === 0) {
    ui.line(renderRootHelp(ui).trimEnd());

    return EXIT_CODE.ok;
  }

  const program = createProgram({
    context: options => {
      ui = createCommandUi(runtime, {
        plain: options.plain ?? requested.plain,
        verbose: options.verbose ?? requested.verbose,
      });

      return createCommandContext(runtime, ui);
    },
    setExitCode: code => {
      exitCode = code;
    },
    ui,
    version: runtime.version,
  });

  try {
    await program.parseAsync([...argv], { from: "user" });

    return exitCode;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (QUIET_EXITS.has(error.code)) return error.exitCode;

      return reportError(ui, fromCommanderError(error));
    }

    return reportError(ui, error);
  }
};
