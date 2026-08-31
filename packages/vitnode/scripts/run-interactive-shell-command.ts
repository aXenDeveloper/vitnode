import { spawn } from "node:child_process";

/**
 * Runs a command to completion, inheriting this process' streams.
 *
 * A shell on Windows only, for the same reason `devPlugin` spawns that way: a
 * `node_modules/.bin` entry there is a `.cmd` batch file, which `spawn` cannot
 * execute directly. Everywhere else the arguments go to the binary untouched, so
 * a path containing a space needs no quoting and nothing in `cmd` or `args` is
 * ever interpreted as shell syntax.
 */
export const runInteractiveShellCommand = async (
  cmd: string,
  args: string[] = [],
) => {
  const shell = process.platform === "win32";

  return await new Promise((resolve, reject) => {
    // `cmd.exe` splits on spaces and Node does not quote for it, so an absolute
    // path out of `node_modules/.bin` would be truncated at the first one.
    const child = spawn(shell ? `"${cmd}"` : cmd, args, {
      stdio: "inherit",
      shell,
      env: process.env,
    });

    child.on("error", error => {
      reject(error);
    });

    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve(true);
      }
    });
  });
};
