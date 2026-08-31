import { spawn } from "node:child_process";
import color from "picocolors";

import { resolveLocalBin } from "./resolve-local-bin.js";

/**
 * `vitnode migrate --generate` in a freshly created project.
 *
 * The only VitNode command a new project still needs run for it, and it is a
 * *convenience* rather than the contract.
 *
 * ## Why this is not what makes a database work
 *
 * It generates migrations; it does not apply them, and it only ever runs on the
 * machine that ran `create-vitnode-app`. A colleague who clones the repository,
 * installs and starts a fresh Postgres never executes this function at all - so
 * the thing that has to prepare a database is the generated `dev` script, which
 * runs `vitnode db:prepare` before any runtime starts. See
 * `create/create-package-json.ts`.
 *
 * ## Why the binary is resolved rather than run through the package manager
 *
 * It was `spawn(packageManager, ["vitnode", "migrate", "--generate"])`, which
 * only two of the three supported managers understand: `npm vitnode …` is
 * "Unknown command", so an npm project reported itself created-but-broken every
 * single time. The path out of `node_modules/.bin` works for all three, and
 * needs no shell.
 *
 * ## Why it is awaited
 *
 * It was fire-and-forget: a bare `spawn` with no `await`, no exit-code check and
 * no error handler, called immediately before `spinner.succeed("Success!
 * Created …")`. So the success message printed while `drizzle-kit` was still
 * running, a non-zero exit was never noticed, and the CLI could exit with the
 * child still alive, writing into a directory the user had been told was
 * finished. Resolving on a zero exit and rejecting otherwise is the whole fix.
 */
export const generateMigrationsVitnode = async ({
  cwd,
}: {
  cwd: string;
}): Promise<void> => {
  const vitnode = resolveLocalBin("vitnode", cwd);

  if (vitnode === null) {
    throw new Error(
      `Could not find the "vitnode" command in ${cwd}. Run "vitnode migrate --generate" there once its dependencies are installed.`,
    );
  }

  const shell = process.platform === "win32";

  await new Promise<void>((resolve, reject) => {
    let output = "";

    const child = spawn(
      shell ? `"${vitnode}"` : vitnode,
      ["migrate", "--generate"],
      {
        cwd,
        env: process.env,
        // A shell on Windows only, where the entry is a `.cmd` batch file `spawn`
        // cannot execute directly - and quoted, because `cmd.exe` splits an
        // unquoted path on its first space.
        shell,
        stdio: "pipe",
      },
    );

    child.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr?.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.on("error", error => {
      reject(
        new Error(
          `Failed to start "vitnode": ${error.message}\nRun "vitnode db:prepare" in the new project once your database is running.`,
        ),
      );
    });

    child.on("close", code => {
      if (code === 0) {
        resolve();

        return;
      }

      if (output.trim().length > 0) {
        console.error(color.red(output.trim()));
      }

      reject(
        new Error(
          `"vitnode migrate --generate" exited with code ${String(code)}. Your project was created - run the dev script once your database is running and it will migrate itself.`,
        ),
      );
    });
  });
};
