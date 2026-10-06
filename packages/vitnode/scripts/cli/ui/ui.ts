import type { Palette } from "./colors";
import type { Symbols } from "./symbols";
import type { RenderTableOptions } from "./table";
import type { TerminalCapabilities, TerminalStream } from "./terminal";

import { createPalette, padEnd, visibleWidth } from "./colors";
import { formatDuration } from "./format";
import { createSymbols } from "./symbols";
import { renderTable } from "./table";

/**
 * `pretty` is for a person: symbols, colors and - when the terminal is
 * interactive - spinners. `plain` is for a log: `[OK]`-style prefixes, one
 * stable line per event, nothing that moves.
 */
export type OutputMode = "plain" | "pretty";

export interface TaskHandle {
  fail: (label?: string) => void;
  /** Ends the task without a result line, e.g. when the step was a no-op. */
  skip: (label?: string) => void;
  succeed: (label?: string, detail?: string) => void;
}

export interface Ui {
  readonly capabilities: TerminalCapabilities;
  readonly colors: Palette;
  error: (text: string) => void;
  /** The opening block of every command: `◆ VitNode` and what it is doing. */
  header: (title: string) => void;
  info: (text: string) => void;
  readonly interactive: boolean;

  keyValue: (rows: readonly (readonly [string, string])[]) => void;
  /** One raw line, written as given. */
  line: (text?: string) => void;
  readonly mode: OutputMode;
  /** A secondary line: a hint, a path, a reason. */
  note: (text: string) => void;
  rule: () => void;
  runTask: <T>(
    label: string,
    action: () => Promise<T>,
    options?: { done?: (result: T) => string | undefined },
  ) => Promise<T>;
  section: (title: string) => void;
  success: (text: string, detail?: string) => void;
  readonly symbols: Symbols;
  table: (options: Omit<RenderTableOptions, "muted" | "rule">) => void;
  task: (label: string) => TaskHandle;
  readonly verbose: boolean;
  warning: (text: string) => void;
  /** Writes to stderr, for diagnostics that must not end up in piped output. */
  writeError: (text?: string) => void;
}

export interface CreateUiOptions {
  capabilities: TerminalCapabilities;
  mode?: OutputMode;
  now?: () => number;
  stderr: TerminalStream;
  stdout: TerminalStream;
  timers?: {
    clear: (handle: ReturnType<typeof setInterval>) => void;
    set: (callback: () => void, ms: number) => ReturnType<typeof setInterval>;
  };
  verbose?: boolean;
}

const INDENT = "  ";
const SPINNER_INTERVAL_MS = 80;
const CLEAR_LINE = "\r\x1b[2K";

export const createUi = ({
  capabilities,
  mode = "pretty",
  now = Date.now,
  stderr,
  stdout,
  timers = {
    clear: handle => {
      clearInterval(handle);
    },
    set: (callback, ms) => setInterval(callback, ms),
  },
  verbose = false,
}: CreateUiOptions): Ui => {
  const plain = mode === "plain";
  const colors = createPalette(capabilities.color && !plain);
  const symbols = createSymbols(capabilities.unicode && !plain);
  const interactive = capabilities.interactive && !plain;

  /** The one spinner that may be on screen, and what it is drawing. */
  let spinner: null | {
    frame: number;
    handle: ReturnType<typeof setInterval>;
    label: string;
  } = null;

  const renderSpinner = () => {
    if (spinner === null) return;
    const glyph = symbols.spinner[spinner.frame % symbols.spinner.length];
    stdout.write(
      `${CLEAR_LINE}${INDENT}${colors.primary(glyph)} ${spinner.label}`,
    );
  };

  /** Anything printed while a spinner runs goes above it, not through it. */
  const write = (stream: TerminalStream, text: string) => {
    if (spinner !== null) stdout.write(CLEAR_LINE);
    stream.write(`${text}\n`);
    renderSpinner();
  };

  const line = (text = "") => {
    write(stdout, text);
  };

  const status = (
    prefix: string,
    plainTag: string,
    text: string,
    detail?: string,
  ) => {
    if (plain) {
      line(`[${plainTag}] ${text}${detail ? ` (${detail})` : ""}`);

      return;
    }
    line(
      `${INDENT}${prefix} ${text}${detail ? `  ${colors.muted(detail)}` : ""}`,
    );
  };

  const success = (text: string, detail?: string) => {
    status(colors.success(symbols.success), "OK", text, detail);
  };

  const warning = (text: string) => {
    status(colors.warning(symbols.warning), "WARN", text);
  };

  const info = (text: string) => {
    status(colors.primary(symbols.dot), "INFO", text);
  };

  const error = (text: string) => {
    if (plain) {
      write(stderr, `[ERROR] ${text}`);

      return;
    }
    write(stderr, `${colors.error(symbols.error)} ${colors.error(text)}`);
  };

  const stopSpinner = () => {
    if (spinner === null) return;
    timers.clear(spinner.handle);
    stdout.write(CLEAR_LINE);
    spinner = null;
  };

  const task = (label: string): TaskHandle => {
    const startedAt = now();
    let ended = false;

    if (interactive) {
      stopSpinner();
      spinner = {
        frame: 0,
        handle: timers.set(() => {
          if (spinner === null) return;
          spinner.frame += 1;
          renderSpinner();
        }, SPINNER_INTERVAL_MS),
        label,
      };
      renderSpinner();
    }

    const end = (print: () => void) => {
      if (ended) return;
      ended = true;
      if (interactive) stopSpinner();
      print();
    };

    const elapsed = () => formatDuration(now() - startedAt);

    return {
      fail: (failedLabel = label) => {
        end(() => {
          status(colors.error(symbols.error), "FAIL", failedLabel);
        });
      },
      skip: skippedLabel => {
        end(() => {
          if (skippedLabel !== undefined) {
            status(colors.muted(symbols.pending), "SKIP", skippedLabel);
          }
        });
      },
      succeed: (doneLabel = label, detail) => {
        end(() => {
          success(doneLabel, detail ?? elapsed());
        });
      },
    };
  };

  return {
    capabilities,
    colors,
    interactive,
    mode,
    symbols,
    verbose,

    error,
    header: title => {
      if (plain) {
        line(`VitNode - ${title}`);

        return;
      }
      line();
      line(colors.primary(`${symbols.brand} VitNode`));
      line(`${INDENT}${colors.muted(title)}`);
      line();
    },
    info,
    keyValue: rows => {
      const width = Math.max(...rows.map(([key]) => visibleWidth(key)));

      rows.forEach(([key, value]) => {
        line(
          plain
            ? `${key}: ${value}`
            : `${INDENT}${colors.muted(padEnd(key, width))}   ${value}`,
        );
      });
    },
    line,
    note: text => {
      line(plain ? text : `${INDENT}${colors.muted(text)}`);
    },
    rule: () => {
      if (plain) return;
      line(colors.muted(symbols.line.repeat(40)));
    },
    runTask: async (label, action, options = {}) => {
      const handle = task(label);

      try {
        const result = await action();
        handle.succeed(label, options.done?.(result));

        return result;
      } catch (thrown) {
        handle.fail();
        throw thrown;
      }
    },
    section: title => {
      line();
      line(plain ? `${title}:` : colors.bold(title));
    },
    success,
    table: options => {
      renderTable({
        ...options,
        muted: colors.muted,
        rule: plain ? "-" : symbols.line,
      }).forEach(row => {
        line(plain ? row : `${INDENT}${row}`);
      });
    },
    task,
    warning,
    writeError: (text = "") => {
      write(stderr, text);
    },
  };
};
