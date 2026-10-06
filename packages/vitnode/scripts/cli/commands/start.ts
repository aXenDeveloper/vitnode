import type { CommandContext, OutputOptions } from "../context";

import { EXIT_CODE, RuntimeError, UserError } from "../errors";
import { ProcessGroup, waitForShutdownSignal } from "../project/processes";
import { detectProject } from "../project/project";
import { detectRuntime, runtimeExecutable } from "../project/runtime";
import { resolveServerEntry } from "../start/server-entry";
import { canConnect, waitForPort } from "../start/wait-for-port";

export interface StartOptions extends OutputOptions {
  host?: string;
  port?: string;
}

export const parsePort = (
  value: string | undefined,
  fallback: number,
): number => {
  if (value === undefined || value === "") return fallback;
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new UserError(`"${value}" is not a valid port.`, {
      hint: "Use a whole number between 1 and 65535.",
    });
  }

  return port;
};

/** The address to show and to probe: a wildcard bind is reachable locally. */
export const displayHost = (host: string | undefined): string =>
  host === undefined || host === "" || host === "0.0.0.0" || host === "::"
    ? "localhost"
    : host;

/**
 * `vitnode start` - the production server the build produced, run with Node.
 *
 * Not a server of VitNode's own: it is the build's entry (`.output/server` for
 * an app, `dist/index.js` for an API), started exactly as `node <entry>`
 * would, with `PORT` and `HOST` passed the way Nitro and the API template
 * already read them. The CLI only adds a readiness check and a clean
 * shutdown: SIGINT or SIGTERM is forwarded, and the server is given time to
 * close before it is killed.
 */
export const runStartCommand = async (
  { cwd, env, signals, ui }: CommandContext,
  options: StartOptions,
): Promise<number> => {
  const project = detectProject(cwd);
  const { defaultPort, entry, runtime } = resolveServerEntry(
    project,
    project.kind === "api" ? detectRuntime(project.root, env) : "node",
  );
  const port = parsePort(options.port ?? env.PORT, defaultPort);
  const host = options.host ?? env.HOST;
  const shownHost = displayHost(host);

  ui.header("Production");

  // Checked before starting anything: something already answering on the port
  // would otherwise pass the readiness probe below for a server that never
  // got to listen.
  if (await canConnect(port, shownHost)) {
    throw new RuntimeError(`Port ${String(port)} is already in use.`, {
      hint: "Stop whatever is listening on it, or pick another port with --port.",
    });
  }

  const group = new ProcessGroup();
  const child = group.spawn({
    args: [entry],
    command: runtimeExecutable(runtime),
    cwd: project.root,
    env: {
      ...env,
      NODE_ENV: env.NODE_ENV ?? "production",
      PORT: String(port),
      ...(host === undefined ? {} : { HOST: host }),
    },
  });

  let exitCode: null | number = null;
  child.once("exit", code => {
    exitCode = code ?? 1;
  });

  const ready = await waitForPort({
    host: shownHost,
    isAlive: () => exitCode === null,
    port,
  });

  if (!ready || exitCode !== null) {
    await group.stop();
    throw new RuntimeError(
      exitCode === null
        ? `The server did not start listening on port ${String(port)} within 60s.`
        : `The server exited with code ${String(exitCode)} before it was ready.`,
    );
  }

  const url = `http://${shownHost}:${String(port)}`;
  ui.line(
    ui.mode === "plain"
      ? `[OK] Running at ${url}`
      : `  ${ui.colors.success(ui.symbols.dot)} Running  ${ui.colors.command(url)}`,
  );
  ui.line();

  const outcome = await Promise.race([
    group.firstExit().then(code => ({ code, kind: "exit" as const })),
    waitForShutdownSignal(signals).then(signal => ({
      kind: "signal" as const,
      signal,
    })),
  ]);

  if (outcome.kind === "signal") {
    ui.line();
    ui.note("Stopping the server...");
    await group.stop();

    return EXIT_CODE.ok;
  }

  return outcome.code === 0 ? EXIT_CODE.ok : outcome.code;
};
