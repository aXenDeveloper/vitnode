import { spawn } from "node:child_process";
import consoleColor from "picocolors";

import type { CreateCliReturn } from "../questions.js";

import { getOnline } from "./is-online.js";

function printInstallErrorSuggestions(
  stderr: string,
  color: typeof consoleColor,
) {
  if (stderr.includes("ENOTFOUND") || stderr.includes("network")) {
    console.error(
      color.yellow(
        "💡 Network error detected. Please check your internet connection.",
      ),
    );
  } else if (
    stderr.includes("EACCES") ||
    stderr.includes("permission denied")
  ) {
    console.error(
      color.yellow(
        "💡 Permission error detected. Try running with elevated privileges or check file permissions.",
      ),
    );
  } else if (stderr.includes("ENOSPC")) {
    console.error(
      color.yellow(
        "💡 Disk space error detected. Please free up some disk space.",
      ),
    );
  } else if (stderr.includes("ERR_PNPM_PEER_DEP_ISSUES")) {
    console.error(
      color.yellow(
        "💡 Peer dependency issues detected. Consider using --force flag or resolve conflicts manually.",
      ),
    );
  }
}

export const installDependencies = async ({
  packageManager: pm,
  cwd,
}: Pick<CreateCliReturn, "packageManager"> & { cwd?: string }) => {
  const packageManager = pm.split("@")[0];
  const isOnline = await getOnline();
  const args: string[] = ["install"];

  if (!isOnline) {
    console.log(
      consoleColor.yellow(
        "You appear to be offline.\nFalling back to the local cache.",
      ),
    );
    args.push("--offline");
  }

  /**
   * Return a Promise that resolves once the installation is finished.
   */
  return new Promise<void>((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    /**
     * Spawn the installation process.
     */
    const child = spawn(packageManager, args, {
      stdio: "pipe",
      cwd,
      shell: true, // Use shell to properly handle Windows batch files
      env: {
        ...process.env,
        ADBLOCK: "1",
        // we set NODE_ENV to development as pnpm skips dev
        // dependencies when production
        NODE_ENV: "development",
        DISABLE_OPENCOLLECTIVE: "1",
      },
    });

    child.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      stdout += output;
    });

    child.stderr?.on("data", (data: Buffer) => {
      const output = data.toString();
      stderr += output;
    });

    child.on("close", code => {
      if (code !== 0) {
        console.error(
          consoleColor.red(`\n❌ Installation failed with exit code: ${code}`),
        );

        if (stderr) {
          console.error(consoleColor.red("Error output:"));
          console.error(stderr);
        }

        if (stdout) {
          console.log(consoleColor.yellow("Standard output:"));
          console.log(stdout);
        }

        printInstallErrorSuggestions(stderr, consoleColor);

        reject(
          new Error(
            `Failed to install dependencies using ${packageManager}. Exit code: ${code}\n${stderr || stdout}`,
          ),
        );

        return;
      }

      resolve();
    });

    child.on("error", error => {
      console.error(
        consoleColor.red(`❌ Failed to start ${packageManager}:`),
        error.message,
      );
      reject(new Error(`Failed to start ${packageManager}: ${error.message}`));
    });
  });
};
