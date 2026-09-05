import { spawn } from "node:child_process";
import color from "picocolors";

import type { CreateCliReturn } from "../questions.js";

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
