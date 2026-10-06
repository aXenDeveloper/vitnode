import type { ChildProcess } from "node:child_process";

import { spawn } from "node:child_process";

import { RuntimeError } from "../errors";

export type Signal = "SIGINT" | "SIGTERM";

/** `process`, as far as shutdown is concerned - injectable for tests. */
export interface SignalSource {
  off: (signal: Signal, listener: () => void) => unknown;
  once: (signal: Signal, listener: () => void) => unknown;
}

/** Resolves with the first of SIGINT or SIGTERM, then stops listening. */
export const waitForShutdownSignal = async (
  signals: SignalSource,
): Promise<Signal> =>
  new Promise(resolve => {
    const onInt = () => {
      cleanup();
      resolve("SIGINT");
    };
    const onTerm = () => {
      cleanup();
      resolve("SIGTERM");
    };
    const cleanup = () => {
      signals.off("SIGINT", onInt);
      signals.off("SIGTERM", onTerm);
    };

    signals.once("SIGINT", onInt);
    signals.once("SIGTERM", onTerm);
  });

export interface RunProcessOptions {
  args: readonly string[];
  /**
   * `true` collects stdout and stderr into `output` instead of printing them,
   * for steps whose output only matters when they fail.
   */
  capture?: boolean;
  command: string;
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

export interface ProcessResult {
  code: number;
  output: string;
}

/** Keeps the end of a long log, which is where the error usually is. */
const MAX_CAPTURE = 256 * 1024;

const spawnChild = (
  options: RunProcessOptions,
  stdio: "inherit" | "pipe",
): ChildProcess =>
  // Never `shell: true`: every command here is an absolute executable - Node
  // itself, running a package's resolved bin script - so there is nothing for
  // a shell to resolve, quote or get wrong on Windows.
  spawn(options.command, [...options.args], {
    cwd: options.cwd,
    env: options.env ?? process.env,
    shell: false,
    stdio: stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

/**
 * Runs a command to completion.
 *
 * Resolves with the exit code rather than rejecting on a non-zero one: whether
 * that is an error, and how to explain it, is the caller's decision. Rejects
 * only when the process could not be started at all.
 */
export const runProcess = async (
  options: RunProcessOptions,
): Promise<ProcessResult> =>
  new Promise((resolve, reject) => {
    const child = spawnChild(options, options.capture ? "pipe" : "inherit");
    let output = "";

    const collect = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.length > MAX_CAPTURE) output = output.slice(-MAX_CAPTURE);
    };

    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);

    child.once("error", error => {
      reject(
        new RuntimeError(`Could not start ${options.command}.`, {
          cause: error,
        }),
      );
    });
    child.once("close", (code, signal) => {
      resolve({ code: code ?? (signal === null ? 0 : 1), output });
    });
  });

/** How long a child gets to exit cleanly before it is killed outright. */
const KILL_TIMEOUT_MS = 5000;

/**
 * Long-running children that live and die together.
 *
 * `vitnode dev` starts several watchers; when one of them exits, or the
 * developer presses Ctrl+C, every one of them has to go - an orphaned `tsc -w`
 * holding a terminal open is exactly what a dev command must never leave
 * behind.
 */
export class ProcessGroup {
  private readonly children = new Set<ChildProcess>();

  /**
   * One promise per child, created the moment it is spawned - so a child that
   * exits before anyone asks (a server crashing during boot) is still seen.
   */
  private readonly exits: Promise<number>[] = [];

  /** Resolves with the exit code of whichever child exits first. */
  async firstExit(): Promise<number> {
    return Promise.race(this.exits);
  }

  spawn(options: RunProcessOptions): ChildProcess {
    const child = spawnChild(options, "inherit");
    this.children.add(child);
    this.exits.push(
      new Promise(resolve => {
        child.once("exit", code => {
          this.children.delete(child);
          resolve(code ?? 1);
        });
        child.once("error", () => {
          this.children.delete(child);
          resolve(1);
        });
      }),
    );

    return child;
  }

  /** SIGTERM to every child, then SIGKILL to whatever is still running. */
  async stop(): Promise<void> {
    const running = [...this.children].filter(
      child => child.exitCode === null && child.signalCode === null,
    );

    await Promise.all(
      running.map(
        async child =>
          new Promise<void>(resolve => {
            const timer = setTimeout(() => {
              child.kill("SIGKILL");
              resolve();
            }, KILL_TIMEOUT_MS);
            timer.unref();

            child.once("exit", () => {
              clearTimeout(timer);
              resolve();
            });
            child.kill("SIGTERM");
          }),
      ),
    );
    this.children.clear();
  }
}
