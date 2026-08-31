import { spawn } from "node:child_process";
import color from "picocolors";

import type { CreateCliReturn } from "../questions.js";

/**
 * `vitnode migrate --generate` in a freshly created project.
 *
 * The only VitNode command a new project still needs run for it, and it is a
 * *convenience* rather than the contract. There was a second one -
 * `initFilesVitnode`, which ran `vitnode prepare-plugins` in every generated app
 * - and it existed for the route copier: each installed plugin's
 * `src/routes/{main,admin,blank,breadcrumb}/` had to be copied into the app's
 * `src/app/[locale]/…` before Next.js could see a plugin's pages at all, so a
 * project that skipped it started with its plugins half-installed.
 *
 * Nothing is copied now. A plugin's routes are compiled into the generated
 * registry by the app's own Vite build, from the plugin's `dist`, on every `dev`
 * and every `build` - so there is no step to run first and no state on disk that
 * can be stale.
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
 * ## Why it is awaited
 *
 * It was fire-and-forget: a bare `spawn` with no `await`, no exit-code check and
 * no error handler, called without `await` from `create-vitnode.ts` immediately
 * before `spinner.succeed("Success! Created …")`. Three consequences, all of
 * them silent. The success message printed while `drizzle-kit` was still
 * running. A non-zero exit was never noticed, so a project whose migrations
 * failed to generate was reported as created. And the CLI could exit with the
 * child still alive, leaving a detached `drizzle-kit` writing into a directory
 * the user had already been told was finished.
 *
 * Resolving on a zero exit and rejecting otherwise is the whole fix. `shell:
 * true` for the same reason `installDependencies` uses it: a package manager on
 * Windows is a batch file, which `spawn` cannot execute directly.
 */
export const generateMigrationsVitnode = async ({
  packageManager: pm,
  cwd,
}: Pick<CreateCliReturn, "packageManager"> & {
  cwd?: string;
}): Promise<void> => {
  const packageManager = pm.split("@")[0];
  const args = ["vitnode", "migrate", "--generate"];

  await new Promise<void>((resolve, reject) => {
    let output = "";

    const child = spawn(packageManager, args, {
      cwd,
      env: process.env,
      shell: true, // Use shell to properly handle Windows batch files
      stdio: "pipe",
    });

    child.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr?.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.on("error", error => {
      reject(
        new Error(
          `Failed to start ${packageManager}: ${error.message}\nRun "${packageManager} vitnode db:prepare" in the new project once your database is running.`,
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
          `"${packageManager} vitnode migrate --generate" exited with code ${String(code)}. Your project was created - run "${packageManager} dev" once your database is running and it will migrate itself.`,
        ),
      );
    });
  });
};
