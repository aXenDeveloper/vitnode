import { runInteractiveShellCommand } from "./run-interactive-shell-command.js";

export const buildPlugin = async () => {
  await runInteractiveShellCommand("tsc", ["-p", "tsconfig.build.json"]);
  await runInteractiveShellCommand("swc", [
    "src",
    "-d",
    "dist",
    "--config-file",
    ".swcrc",
  ]);
  await runInteractiveShellCommand("tsc-alias", ["-p", "tsconfig.build.json"]);
};
