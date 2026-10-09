export interface OutputCapture {
  /** Stops capturing and returns everything that was written meanwhile. */
  restore: () => string;
}

type Write = typeof process.stdout.write;

/**
 * Holds back what third-party code prints straight to the console - build
 * plugins, or a database driver logging every Postgres NOTICE.
 *
 * Vite's own logging goes through a logger VitNode controls, but plugins such
 * as Nitro and the TanStack devtools write to `process.stdout` directly - and
 * one stray line through a spinner leaves the terminal garbled. The CLI's own
 * UI keeps a reference to the original `write`, so it is unaffected.
 *
 * Nothing is thrown away: `--verbose` skips the capture entirely, and a failed
 * build prints what was captured with its error.
 */
export const captureProcessOutput = (): OutputCapture => {
  const chunks: string[] = [];
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;

  const capture = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    chunks.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
    );
    const callback = rest.find(arg => typeof arg === "function") as
      | (() => void)
      | undefined;
    callback?.();

    return true;
  }) as Write;

  process.stdout.write = capture;
  process.stderr.write = capture;

  return {
    restore: () => {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;

      return chunks.join("");
    },
  };
};

/**
 * Runs `action` with console output held back unless `--verbose`. If it fails,
 * what was held back is printed after all - it is the context of the error.
 */
export const withQuietOutput = async <T>(
  verbose: boolean,
  action: () => Promise<T>,
  capture: () => OutputCapture = captureProcessOutput,
): Promise<T> => {
  if (verbose) return action();

  const session = capture();
  try {
    return await action();
  } catch (error) {
    process.stderr.write(session.restore());
    throw error;
  } finally {
    session.restore();
  }
};
