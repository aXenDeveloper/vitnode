import { EventEmitter } from "node:events";

import type { CliRuntime, CommandContext, Env } from "./context";
import type { Signal, SignalSource } from "./project/processes";
import type { Prompter } from "./ui/prompts";

import { createCommandContext, createCommandUi } from "./context";
import { stripAnsi } from "./ui/colors";

export interface FakeTerminal {
  /** Everything written to stderr, ANSI stripped. */
  errors: () => string;
  /** Everything written to stdout, ANSI stripped. */
  output: () => string;
  /** Everything, raw - for asserting on escape codes themselves. */
  raw: () => string;
}

export interface FakeSignals extends SignalSource {
  emit: (signal: Signal) => void;
}

export const createFakeSignals = (): FakeSignals => {
  const emitter = new EventEmitter();

  return {
    emit: signal => emitter.emit(signal),
    off: (signal, listener) => emitter.off(signal, listener),
    once: (signal, listener) => emitter.once(signal, listener),
  };
};

export interface FakeRuntimeOptions {
  cwd?: string;
  env?: Env;
  interactive?: boolean;
  prompter?: Prompter;
}

/**
 * A runtime with an in-memory terminal: what a command printed can be read
 * back, and whether the terminal "is" interactive is a switch.
 */
export const createFakeRuntime = ({
  cwd = process.cwd(),
  env = {},
  interactive = false,
  prompter,
}: FakeRuntimeOptions = {}): CliRuntime &
  FakeTerminal & { signals: FakeSignals } => {
  const out: string[] = [];
  const err: string[] = [];
  const all: string[] = [];

  return {
    createPrompter: prompter === undefined ? undefined : () => prompter,
    cwd,
    env: { TERM: "xterm-256color", ...env },
    errors: () => stripAnsi(err.join("")),
    output: () => stripAnsi(out.join("")),
    platform: "linux",
    raw: () => all.join(""),
    signals: createFakeSignals(),
    stderr: {
      isTTY: interactive,
      write: chunk => {
        err.push(chunk);
        all.push(chunk);

        return true;
      },
    },
    stdin: { isTTY: interactive },
    stdout: {
      columns: 120,
      isTTY: interactive,
      write: chunk => {
        out.push(chunk);
        all.push(chunk);

        return true;
      },
    },
    version: "1.2.3-test",
  };
};

/** A command context over a fake runtime, the way `runCli` builds one. */
export const createTestContext = (
  options: FakeRuntimeOptions & { plain?: boolean; verbose?: boolean } = {},
): {
  context: CommandContext;
  runtime: ReturnType<typeof createFakeRuntime>;
} => {
  const runtime = createFakeRuntime(options);
  const ui = createCommandUi(runtime, {
    plain: options.plain,
    verbose: options.verbose,
  });

  return { context: createCommandContext(runtime, ui), runtime };
};

/** A prompter that answers from a script and records the questions. */
export const createScriptedPrompter = (answers: {
  confirm?: boolean[];
  text?: string[];
}): Prompter & { asked: string[] } => {
  const asked: string[] = [];
  const confirms = [...(answers.confirm ?? [])];
  const texts = [...(answers.text ?? [])];

  return {
    asked,
    confirm: async message => {
      asked.push(message);

      return Promise.resolve(confirms.shift() ?? true);
    },
    text: async (message, options) => {
      asked.push(message);
      // An empty answer is Enter on the suggested default, as in a terminal.
      const answer = texts.shift();

      return Promise.resolve(
        answer === undefined || answer === ""
          ? (options?.default ?? "")
          : answer,
      );
    },
  };
};
