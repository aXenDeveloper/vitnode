/* eslint-disable no-console */
import { spawn } from "node:child_process";

import { processPlugin } from "./plugin.js";

const spawnWatch = (command: string, args: string[]) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  child.on("error", error => {
    console.error(`\x1b[31m${command} failed:\x1b[0m`, error);
  });

  child.on("exit", code => {
    if (code !== null && code !== 0) {
      console.error(`\x1b[31m${command} exited with code ${code}\x1b[0m`);
    }
  });

  return child;
};

export const devPlugin = ({ initMessage }: { initMessage: string }) => {
  const children = [
    spawnWatch("tsc", [
      "-w",
      "-p",
      "tsconfig.build.json",
      "--preserveWatchOutput",
    ]),
    spawnWatch("swc", [
      "src",
      "-d",
      "dist",
      "--config-file",
      ".swcrc",
      // Keeps locale JSON in `dist` alongside the compiled barrel.
      "--copy-files",
      "-w",
    ]),
    spawnWatch("tsc-alias", ["-w", "-p", "tsconfig.build.json"]),
  ];

  const shutdown = () => {
    children.forEach(child => child.kill());
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  processPlugin({ initMessage });
};
