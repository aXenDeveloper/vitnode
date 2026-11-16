import type { SignalSource } from "./project/processes";
import type { Prompter } from "./ui/prompts";
import type { TerminalInput, TerminalStream } from "./ui/terminal";
import type { Ui } from "./ui/ui";

import { createPrompter } from "./ui/prompts";
import { detectTerminal } from "./ui/terminal";
import { createUi } from "./ui/ui";

export type Env = Record<string, string | undefined>;

/**
 * Everything the CLI reads from the process it runs in.
 *
 * Commands never touch `process` directly - they get this, so a test can run
 * `vitnode build` against a fake terminal, a fake environment and a fake
 * Ctrl+C without spawning anything.
 */
export interface CliRuntime {
  createPrompter?: (ui: Ui) => Prompter;
  cwd: string;
  env: Env;
  platform: NodeJS.Platform;
  signals: SignalSource;
  stderr: TerminalStream;
  stdin: TerminalInput;
  stdout: TerminalStream;
  version: string;
}

export interface OutputOptions {
  plain?: boolean;
  verbose?: boolean;
}

/** What a command handler receives. */
export interface CommandContext {
  cwd: string;
  env: Env;
  platform: NodeJS.Platform;
  prompter: Prompter;
  signals: SignalSource;
  ui: Ui;
  version: string;
}

export const createCommandUi = (
  runtime: CliRuntime,
  { plain = false, verbose = false }: OutputOptions,
): Ui =>
  createUi({
    capabilities: detectTerminal({
      env: runtime.env,
      platform: runtime.platform,
      plain,
      stdin: runtime.stdin,
      stdout: runtime.stdout,
    }),
    mode: plain ? "plain" : "pretty",
    stderr: runtime.stderr,
    stdout: runtime.stdout,
    verbose,
  });

export const createCommandContext = (
  runtime: CliRuntime,
  ui: Ui,
): CommandContext => ({
  cwd: runtime.cwd,
  env: runtime.env,
  platform: runtime.platform,
  prompter: (runtime.createPrompter ?? createPrompter)(ui),
  signals: runtime.signals,
  ui,
  version: runtime.version,
});
