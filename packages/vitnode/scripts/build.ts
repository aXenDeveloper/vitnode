import { runInteractiveShellCommand } from "./run-interactive-shell-command.js";
import { writePluginApiRegistry } from "./write-plugin-api-registry.js";

export const buildPlugin = async () => {
  writePluginApiRegistry();
  await runInteractiveShellCommand("tsc", ["-p", "tsconfig.build.json"]);
  await runInteractiveShellCommand("swc", [
    "src",
    "-d",
    "dist",
    "--config-file",
    ".swcrc",
    // Carries locale JSON (and other assets) into `dist`, next to the compiled
    // `locales/index.js` barrel that imports it.
    "--copy-files",
  ]);
  await runInteractiveShellCommand("tsc-alias", ["-p", "tsconfig.build.json"]);
};
