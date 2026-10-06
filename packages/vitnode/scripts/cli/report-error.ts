import type { Ui } from "./ui/ui";

import { errorMessage, EXIT_CODE, isCliError } from "./errors";

/** Lines of a failed child's output shown without `--verbose`. */
const OUTPUT_TAIL_LINES = 60;

const stackOf = (error: unknown): string | undefined =>
  error instanceof Error ? error.stack : undefined;

const printOutput = (ui: Ui, output: string) => {
  const lines = output.trimEnd().split(/\r?\n/);
  const shown = ui.verbose ? lines : lines.slice(-OUTPUT_TAIL_LINES);

  ui.writeError();
  if (shown.length < lines.length) {
    ui.writeError(
      ui.colors.muted(
        `  … ${String(lines.length - shown.length)} earlier lines hidden (--verbose shows everything)`,
      ),
    );
  }
  shown.forEach(line => {
    ui.writeError(`  ${line}`);
  });
};

/**
 * The CLI's single error boundary: every failure leaves through here, and this
 * is the only place that turns one into text and an exit code.
 *
 * A {@link CliError} was written by VitNode and is printed as a message with
 * its details. Anything else is a bug or a dependency's surprise - its stack is
 * the only honest description, so `--verbose` prints it, and normal mode says
 * how to get it rather than paraphrasing a message VitNode did not write.
 */
export const reportError = (ui: Ui, error: unknown): number => {
  const plain = ui.mode === "plain";
  const hintLine = (hint: string) =>
    plain ? `Hint: ${hint}` : `  ${ui.colors.muted(hint)}`;

  if (isCliError(error)) {
    ui.writeError();
    ui.error(error.message);
    error.details.forEach(detail => {
      ui.writeError(`  ${detail}`);
    });

    if (error.output !== undefined && error.output.trim() !== "") {
      printOutput(ui, error.output);
    }

    if (error.hint !== undefined) {
      ui.writeError();
      ui.writeError(hintLine(error.hint));
    }

    if (ui.verbose && error.cause !== undefined) {
      ui.writeError();
      ui.writeError(
        ui.colors.muted(stackOf(error.cause) ?? errorMessage(error.cause)),
      );
    }

    return error.exitCode;
  }

  ui.writeError();
  ui.error(`Unexpected error: ${errorMessage(error)}`);

  if (ui.verbose) {
    const stack = stackOf(error);
    if (stack !== undefined) ui.writeError(ui.colors.muted(stack));
  } else {
    ui.writeError(
      hintLine(
        "Run the command again with --verbose for the full stack trace.",
      ),
    );
  }

  return EXIT_CODE.failure;
};
